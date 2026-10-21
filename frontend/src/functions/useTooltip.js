import { reactive } from "vue";

export default function useTooltip(tooltipElement = null) {
  const tooltip = reactive({
    show: false,
    data: {},
    target: null,
  });

  const setTooltip = (data) => {
    if (data) {
      // show tooltip
      tooltip.target = data.target || data.event.target;
      tooltip.data = data.data;
      tooltip.meta = data.meta;

      // force the update of the tooltip - for when the target is the same but in a different position
      if (tooltipElement) tooltipElement.value.createPopper();

      tooltip.show = true;
    } else {
      // hide tooltip
      tooltip.show = false;
    }
  };

  return [tooltip, setTooltip];
}
