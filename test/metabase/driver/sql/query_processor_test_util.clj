(ns metabase.driver.sql.query-processor-test-util
  (:require [clojure.string :as str]
            [clojure.test :refer :all]
            [honeysql.format :as hformat]
            [metabase.driver :as driver]
            [metabase.driver.sql.query-processor :as sql.qp]
            [metabase.driver.util :as driver.u]
            [metabase.query-processor :as qp]
            [metabase.test :as mt]
            [metabase.util :as u]))

;; [[install-pretty-formatters!]] -- tweaks the actual methods HoneySQL uses to generate SQL strings to add indentation

(defonce ^:private ^clojure.lang.MultiFn orig-format-clause hformat/format-clause)

(defn remove-pretty-formatters!
  "Remove the pretty formatters installed by [[install-pretty-formatters!]]."
  []
  (alter-var-root #'hformat/format-clause (constantly orig-format-clause)))

(defmulti ^:private pretty-format
  "Special version of [[hformat/format-clause]] that indents and pretty-prints the resulting form."
  {:arglists '([clause sql-map])}
  (.dispatchFn orig-format-clause))

(defn install-pretty-formatters!
  "Install code so HoneySQL will pretty-print the SQL it generates."
  []
  (alter-var-root #'hformat/format-clause (constantly pretty-format)))

(defn- pretty-formatters-installed?
  "Whether pretty formatters were installed by [[install-pretty-formatters!]] or not."
  []
  (identical? hformat/format-clause pretty-format))

(defn do-with-pretty-formatters
  "Impl for [[with-pretty-formatters]]."
  [thunk]
  (if (pretty-formatters-installed?)
    (thunk)
    (try
      (install-pretty-formatters!)
      (thunk)
      (finally
        (remove-pretty-formatters!)))))

(defmacro with-pretty-formatters
  "Execute body with the pretty formatters from [[install-pretty-formatters!]] temporarily installed (if they are not
  already installed)."
  [& body]
  `(do-with-pretty-formatters (fn [] ~@body)))

(def ^:private ^:dynamic *indent* 0)

(defn- indent [] (str/join (repeat (* *indent* 2) \space)))

(defn- newline-and-indent []
  (str \newline (indent)))

(defmethod pretty-format :default
  [clause sql-map]
  (str
   (newline-and-indent)
   (binding [*indent* (inc *indent*)]
     (orig-format-clause clause sql-map))))

(defmethod pretty-format :select
  [[_ fields] sql-map]
  (str
   (newline-and-indent)
   "SELECT "
   (when (:modifiers sql-map)
     (str (hformat/format-modifiers (:modifiers sql-map)) " "))
   (binding [*indent* (inc *indent*)]
     (str
      (newline-and-indent)
      (str/join (str ","(newline-and-indent)) (map hformat/to-sql fields))))))


;;;; [[query->sql-map]] and [[sql->sql-map]] -- these parse an actual SQL map into a pseudo-HoneySQL form

(defn pretty-sql
  "Remove quotes around identifiers (where possible) and remove `public.` qualifiers."
  [s]
  (if-not (string? s)
    s
    (-> s
        (str/replace #"\"([\w\d_-]+)\"" "$1")
        (str/replace #"PUBLIC\." "")
        (str/replace #"public\." ""))))

(defn even-prettier-sql
  "Do [[pretty-sql]] transformations, and remove excess whitespace and *all* quote marks."
  [s]
  (-> s
      pretty-sql
      (str/replace #"\s+" " ")
      (str/replace #"\(\s*" "(")
      (str/replace #"\s*\)" ")")
      (str/replace #"'" "\"")
      str/trim))

(defn- symbols [s]
  (binding [*read-eval* false]
    (read-string (str \( s \)))))

(def ^:private sql-keywords
  '#{[LEFT JOIN]
     [GROUP BY]
     [ORDER BY]
     SELECT
     FROM
     LIMIT
     WHERE
     OFFSET
     HAVING})

(defn- sql-map
  "Convert a sequence of SQL symbols into something sorta like a HoneySQL map. The main purpose of this is to make tests
  somewhat possible to debug. The goal isn't to actually be HoneySQL, but rather to make diffing huge maps easy."
  [symbols]
  (if-not (sequential? symbols)
    symbols
    (loop [m {}, current-key nil, [x & [y :as more]] symbols]
      (cond
        ;; two-word "keywords"
        (sql-keywords [x y])
        (let [x-y (keyword (str/lower-case (format "%s-%s" (name x) (name y))))]
          (recur m x-y (rest more)))

        ;; one-word keywords
        (sql-keywords x)
        (let [x (keyword (str/lower-case x))]
          (recur m x more))

        ;; if we stumble upon a nested sequence that starts with SQL keyword(s) then recursively transform that into a
        ;; map (e.g. for things like subselects)
        (and (sequential? x)
             (or (sql-keywords (take 2 x))
                 (sql-keywords (first x))))
        (recur m current-key (cons (sql-map x) more))

        :else
        (let [m (update m current-key #(conj (vec %) x))]
          (if more
            (recur m current-key more)
            m))))))

(defn sql->sql-map
  "Convert a `sql` string into a HoneySQL-esque map for easy diffing."
  [sql]
  (-> sql even-prettier-sql symbols sql-map))

(defn query->raw-native-query
  "Compile an MBQL query to a raw native query (excluding params)."
  ([{database-id :database, :as query}]
   (query->raw-native-query (or driver/*driver*
                       (driver.u/database->driver database-id))
                   query))

  ([driver query]
   (mt/with-everything-store
     (driver/with-driver driver
       (-> (sql.qp/mbql->native driver (qp/query->preprocessed query))
           :query)))))

(def ^{:arglists '([query] [driver query])} query->sql
  "Compile an MBQL query to 'pretty' SQL (i.e., remove quote marks and `public.` qualifiers)."
  (comp pretty-sql query->raw-native-query))

(def ^{:arglists '([query] [driver query])} query->sql-map
  "Compile MBQL query to SQL and parse it as a HoneySQL-esque map."
  (comp sql->sql-map query->sql))


;;;; [[testing]] context tooling

(defn pprint-native-query-with-best-strategy
  "Attempt to compile `query` to a native query, and pretty-print it if possible."
  [query]
  (with-pretty-formatters
    (u/ignore-exceptions
      (let [native (query->raw-native-query query)]
        (str "\nNative Query =\n"
             (if (string? native)
               native
               (u/pprint-to-str native)))))))

(defmacro with-native-query-testing-context
  "Compile `query` to a native query (and pretty-print it if it is SQL) and add it as [[testing]] context around
  `body`."
  [query & body]
  `(testing (pprint-native-query-with-best-strategy ~query)
     (try
       ~@body
       (catch Throwable e#
         (testing (u/colorize 'red "\nUnexpected exception")
           (is (not e#)))))))
