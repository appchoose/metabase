/* eslint-disable react/prop-types */
import React from "react";
import { Box, Flex } from "grid-styled";
import { t, jt } from "ttag";
import _ from "underscore";

import { isDate } from "metabase/lib/schema_metadata";
import { formatNumber, formatValue } from "metabase/lib/formatting";
import { color } from "metabase/lib/colors";

import Icon from "metabase/components/Icon";

import { formatBucketing } from "metabase/lib/query_time";

import { columnSettings } from "metabase/visualizations/lib/settings/column";
// import { NoBreakoutError } from "metabase/visualizations/lib/errors";

import ScalarValue, {
  ScalarWrapper,
  ScalarTitle,
} from "metabase/visualizations/components/ScalarValue";

export default class Smart extends React.Component {
  static uiName = t`Trend`;
  static identifier = "smartscalar";
  static iconName = "smartscalar";

  static minSize = { width: 3, height: 3 };

  static noHeader = true;

  _scalar: ?HTMLElement;

  static settings = {
    ...columnSettings({
      getColumns: (
        [
          {
            data: { cols },
          },
        ],
        settings,
      ) => [
        // try and find a selected field setting
        cols.find(col => col.name === settings["scalar.field"]) ||
          // fall back to the second column
          cols[1] ||
          // but if there's only one column use that
          cols[0],
      ],
    }),
    "scalar.switch_positive_negative": {
      title: t`Switch positive / negative colors?`,
      widget: "toggle",
    },
    click_behavior: {},
  };

  static isSensible({ insights }) {
    return true
  }

  // Smart scalars need to have a breakout
  static checkRenderable(
    [
      {
        data: { insights },
      },
    ],
    settings,
  ) {
    if (!insights || insights.length === 0) {
      // use Choose custom view
      console.log("Switching to Choose custom view")
      return true
    }
  }

  render() {
    const {
      actionButtons,
      onChangeCardAndRun,
      onVisualizationClick,
      isDashboard,
      settings,
      visualizationIsClickable,
      series: [
        {
          card,
          data: { rows, cols },
        },
      ],
      rawSeries,
    } = this.props;

    const metricIndex = cols.findIndex(col => !isDate(col));
    const dimensionIndex = cols.findIndex(col => isDate(col));

    const lastRow = rows[rows.length - 1];
    const value = lastRow && lastRow[metricIndex];
    const column = cols[metricIndex];

    const insights =
      rawSeries && rawSeries[0].data && rawSeries[0].data.insights;
    const insight = _.findWhere(insights, { col: column.name });

    const isSwapped = settings["scalar.switch_positive_negative"];

    let lastValue
    const trends = []
    if (!insight) {
      // Choose custom smartScalar
      const cols = rawSeries[0].data.cols;
      const bucketIdx = _.findIndex(cols, (col) => col.base_type === 'type/Text');
      if (bucketIdx > -1) {
        const valueIdx = _.findIndex(cols, (val) => val.display_name === column.name);
        lastValue = rawSeries[0].data.rows[0][valueIdx];
        rawSeries[0].data.rows.forEach((row, idx) => {
          if (!idx) { return }
          const trend = {
            granularity: formatBucketing(row[bucketIdx]).toLowerCase(),
            previousValue: row[valueIdx],
            lastChange: (lastValue - row[valueIdx])/row[valueIdx],
          }
          trend.isNegative = trend.lastChange < 0;
          trend.changeColor = (isSwapped ? !trend.isNegative: trend.isNegative)
              ? color("error")
              : color("success");
          trends.push(trend)
        })
      } else {
        return null;
      }
    } else {
      const granularity = formatBucketing(insight["unit"]).toLowerCase();

      const lastChange = insight["last-change"];
      const previousValue = insight["previous-value"];

      const isNegative = lastChange < 0;

      // if the number is negative but thats been identified as a good thing (e.g. decreased latency somehow?)
      const changeColor = (isSwapped
      ? !isNegative
      : isNegative)
        ? color("error")
        : color("success");
      trends.push({granularity, lastChange, previousValue, isNegative, changeColor})

      lastValue = insight["last-value"]
    }

    const changeDisplay = (value) => (
      <span style={{ fontWeight: 900 }}>
        {formatNumber(Math.abs(value), { number_style: "percent" })}
      </span>
    );
    const separator = (
      <span
        style={{
          color: color("text-light"),
          fontSize: "0.7rem",
          marginLeft: 4,
          marginRight: 4,
        }}
      >
        •
      </span>
    );
    const granularityDisplay = (value) => (
      <span style={{ marginLeft: 5 }}>{jt`last ${value}`}</span>
    );

    const clicked = {
      value,
      column,
      dimensions: [
        {
          value: rows[rows.length - 1][dimensionIndex],
          column: cols[dimensionIndex],
        },
      ],
      data: rows[rows.length - 1].map((value, index) => ({
        value,
        col: cols[index],
      })),
      settings,
    };

    const isClickable = visualizationIsClickable(clicked);

    return (
      <ScalarWrapper>
        <div className="Card-title absolute top right p1 px2">
          {actionButtons}
        </div>
        <span
          onClick={
            isClickable &&
            (() =>
              this._scalar &&
              onVisualizationClick({ ...clicked, element: this._scalar }))
          }
          ref={scalar => (this._scalar = scalar)}
        >
          <ScalarValue
            value={formatValue(lastValue, settings.column(column))}
          />
        </span>
        {isDashboard && (
          <ScalarTitle
            title={settings["card.title"]}
            description={settings["card.description"]}
            onClick={
              onChangeCardAndRun &&
              (() => onChangeCardAndRun({ nextCard: card }))
            }
          />
        )}
        <Box className="SmartWrapper">
          {!trends.length ? (
            <Box
              className="text-centered text-bold mt1"
              color={color("text-medium")}
            >{jt`Nothing to compare for the previous .`}</Box>
          ) : (
            <div>
            {trends.map((trend, idx) => {
              return (
                <Flex key={idx} align="center" mt={1} flexWrap="wrap">
                  <Flex align="center" color={trend.changeColor}>
                    <Icon
                      size={13}
                      pr={1}
                      name={trend.isNegative ? "arrow_down" : "arrow_up"}
                    />
                    {changeDisplay(trend.lastChange)}
                  </Flex>
                  <h4
                    id="SmartScalar-PreviousValue"
                    className="flex align-center hide lg-show"
                    style={{
                      color: color("text-medium"),
                    }}
                  >
                    {jt`${separator} was ${formatValue(
                        trend.previousValue,
                        settings.column(column),
                      )} ${granularityDisplay(trend.granularity)}`}
                  </h4>
                </Flex>
              )})}
              </div>
          )}
        </Box>
      </ScalarWrapper>
    );
  }
}
