/** Links for progressively smaller steps through a catalog, in either direction. */
export function browseJumpPages(page: number, pageCount: number): number[] {
  const jumps: number[] = [];
  for (let step = 4; step < pageCount; step *= 4) {
    for (const target of [page - step, page + step]) {
      if (target > 1 && target < pageCount) jumps.push(target);
    }
  }
  return jumps.sort((a, b) => a - b);
}
