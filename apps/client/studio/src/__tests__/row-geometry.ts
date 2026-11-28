const ROW_HEIGHT = 40;

/** jsdom lays nothing out: every list row gets a box one below the other, so a keyboard drag can move. */
export function stubRowGeometry() {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const row = this.closest('li');
    const top = row ? [...(row.parentElement?.children ?? [])].indexOf(row) * ROW_HEIGHT : 0;
    return new DOMRect(0, top, 300, row ? ROW_HEIGHT : 0);
  });
}

const COLUMN_WIDTH = 120;

/** The same for a row laid out side by side, such as the tab strip. */
export function stubColumnGeometry() {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const item = this.closest('li');
    const left = item ? [...(item.parentElement?.children ?? [])].indexOf(item) * COLUMN_WIDTH : 0;
    return new DOMRect(left, 0, item ? COLUMN_WIDTH : 0, 40);
  });
}
