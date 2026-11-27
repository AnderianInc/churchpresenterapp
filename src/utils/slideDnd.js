import { v4 as uuidv4 } from 'uuid';

// Drag-and-drop payload for copying a single slide between slide groups
// (schedule items and song library entries).
//
// Custom MIME type so it never collides with the schedule's own reorder drag
// (which carries no data). Browsers only expose dataTransfer.types during
// dragover, so drop targets check with hasSlideDrag() and read the payload on drop.
export const SLIDE_DRAG_MIME = 'application/x-churchpresenter-slide';

// Dragging a whole service-order item (schedule row) onto the slide strip
// copies that item's slides into the current item.
export const SCHEDULE_ITEM_DRAG_MIME = 'application/x-churchpresenter-schedule-item';

export function startScheduleItemDrag(e, scheduleId) {
  e.dataTransfer.effectAllowed = 'copyMove';
  e.dataTransfer.setData(SCHEDULE_ITEM_DRAG_MIME, String(scheduleId));
}

export function hasScheduleItemDrag(e) {
  return Array.from(e.dataTransfer?.types || []).includes(SCHEDULE_ITEM_DRAG_MIME);
}

/** Returns the dragged schedule item's scheduleId, or null. */
export function readScheduleItemDrag(e) {
  const id = e.dataTransfer?.getData(SCHEDULE_ITEM_DRAG_MIME);
  return id || null;
}

// The look of the item a slide came from (background, text colour, font), so a
// new service item built from that slide renders the same way.
export function pickItemStyle(item) {
  const style = {};
  ['background', 'textColor', 'fontFamily', 'fontSize'].forEach(k => {
    if (item?.[k] !== undefined) style[k] = item[k];
  });
  return style;
}

export function startSlideDrag(e, slide, itemStyle = {}) {
  e.dataTransfer.effectAllowed = 'copy';
  e.dataTransfer.setData(SLIDE_DRAG_MIME, JSON.stringify({ slide, itemStyle }));
}

export function hasSlideDrag(e) {
  return Array.from(e.dataTransfer?.types || []).includes(SLIDE_DRAG_MIME);
}

/** Returns { slide, itemStyle } for the dragged slide, or null if the drop has no valid slide payload. */
export function readSlideDrag(e) {
  try {
    const raw = e.dataTransfer?.getData(SLIDE_DRAG_MIME);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.slide || typeof parsed.slide !== 'object') return null;
    return { slide: parsed.slide, itemStyle: parsed.itemStyle && typeof parsed.itemStyle === 'object' ? parsed.itemStyle : {} };
  } catch {
    return null;
  }
}

/** Copy of a slide with a fresh id, so it doesn't collide with the source slide's key. */
export function copySlideForTarget(slide) {
  return { ...slide, id: uuidv4() };
}
