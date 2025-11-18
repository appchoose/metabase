import cx from "classnames";
import PropTypes from "prop-types";
import { Component } from "react";

import CS from "metabase/css/core/index.css";
import { PLUGIN_LOGO_ICON_COMPONENTS } from "metabase/plugins";

export class DefaultLogoIcon extends Component {
  static defaultProps = {
    height: 32,
  };
  static propTypes = {
    width: PropTypes.number,
    height: PropTypes.number,
    dark: PropTypes.bool,
    fill: PropTypes.string,
  };

  render() {
    const { dark, height, width, fill = "currentcolor" } = this.props;
    return (
      <svg
        className={cx(
          "Icon",
          { [CS.textMetabaseBrand]: !dark },
          { [CS.textWhite]: dark },
        )}
        viewBox="0 0 1200 1200"
        width={width}
        height={height}
        fill={fill}
        data-testid="main-logo"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M929.798 761.248C976.308 716.168 1000 662.419 1000 600.001C1000 537.582 976.308 483.833 929.798 439.62C883.288 394.54 827.125 372 761.31 372C695.494 372 639.332 394.54 592.822 439.62C546.312 483.833 523.496 537.582 523.496 600.001C523.496 662.419 546.312 716.168 592.822 761.248C639.332 805.461 695.494 828.001 761.31 828.001C827.125 828.001 883.288 805.461 929.798 761.248ZM804.309 803.728C779.738 803.728 756.922 786.389 735.861 751.712C714.8 717.035 699.004 677.157 687.596 632.944C677.066 587.864 671.801 547.118 671.801 509.84C671.801 434.418 686.719 397.14 716.555 397.14C740.249 397.14 763.065 414.479 785.003 448.289C806.942 482.099 822.738 520.244 834.146 564.457C845.554 608.67 851.697 648.548 851.697 684.959C851.697 757.781 835.023 803.728 804.309 803.728Z" />
        <path d="M606.302 761.248C652.811 716.168 676.505 662.419 676.505 600.001C676.505 537.582 652.811 483.833 606.302 439.62C559.792 394.54 503.629 372 437.814 372C371.998 372 315.836 394.54 269.326 439.62C222.816 483.833 200 537.582 200 600.001C200 662.419 222.816 716.168 269.326 761.248C315.836 805.461 371.998 828.001 437.814 828.001C503.629 828.001 559.792 805.461 606.302 761.248ZM480.813 803.728C456.242 803.728 433.426 786.389 412.365 751.712C391.304 717.035 375.508 677.157 364.1 632.944C353.57 587.864 348.305 547.118 348.305 509.84C348.305 434.418 363.223 397.14 393.059 397.14C416.753 397.14 439.569 414.479 461.507 448.289C483.446 482.099 499.242 520.244 510.65 564.457C522.058 608.67 528.2 648.548 528.2 684.959C528.2 757.781 511.527 803.728 480.813 803.728Z" />
      </svg>
    );
  }
}

export default function LogoIcon(props) {
  const [Component = DefaultLogoIcon] = PLUGIN_LOGO_ICON_COMPONENTS;
  return <Component {...props} />;
}
