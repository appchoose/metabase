(ns metabase.driver.case-insensitive-identifiers
  "Drivers whose identifiers are case-insensitive can derive from
  `:metabase.driver.case-insensitive-identifiers/case-insensitive-identifiers` to use special methods that are built
  to handle those situations."
  (:require [metabase.driver :as driver]))

(driver/register! ::case-insensitive-identifiers, :abstract? true)
