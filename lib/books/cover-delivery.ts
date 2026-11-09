import { boundedCoverUrl, COVER_WIDTHS, type CoverWidth } from './bounded-cover-url.ts';
import { getOpenLibraryCoverVariantUrl, type CoverPresentation } from './covers.ts';
export const coverSizes: Record<CoverPresentation, string> = {
  compact: '72px',
  taste: '(max-width: 430px) 119px, 190px',
  card: '(max-width: 760px) calc((100vw - 92px) / 2), (max-width: 1200px) calc((100vw - 172px) / 3), 200px',
  detail: '(max-width: 780px) min(calc(78vw - 40px), 250px), 312px',
};
/** Provider sizes retain the selected cover identity. Every retry and srcset
 * candidate uses the same byte gate, including already-reviewed card sources. */
export function boundedCoverAttempts(url: string, presentation: CoverPresentation) {
  const small = boundedCoverUrl(getOpenLibraryCoverVariantUrl(url,'S'));
  const medium = boundedCoverUrl(getOpenLibraryCoverVariantUrl(url,'M'));
  const large = boundedCoverUrl(getOpenLibraryCoverVariantUrl(url,'L'));
  if (!large || !medium || !small) return [];
  if (large === medium) return [{ src:boundedCoverUrl(url,presentation === 'detail' ? 'screen' : 'thumb')! }];
  const widths = COVER_WIDTHS.slice(0,presentation === 'compact' ? 2 : presentation === 'detail' ? 6 : 4);
  const variant = (width: CoverWidth) => boundedCoverUrl(getOpenLibraryCoverVariantUrl(url,width <= 160 ? 'M' : 'L'),width)!;
  const srcSet = widths.map(width => `${variant(width)} ${width}w`).join(', ');
  const src = variant(presentation === 'compact' ? 96 : presentation === 'detail' ? 512 : 256);
  return presentation === 'detail' ? [{src,srcSet},{src:medium},{src:small}] :
    [{src,srcSet},{src:medium},{src:small},{src:large}];
}

/** These slots follow the current CSS grid, including Browse's 320px single column. */
export const responsiveCoverSizes = {
  browse: '(max-width: 359px) calc(100vw - 62px), (max-width: 760px) calc((100vw - 100px) / 2), (max-width: 873px) calc((100vw - 170px) / 3), (max-width: 1085px) calc((100vw - 218px) / 4), (max-width: 1297px) calc((100vw - 266px) / 5), 169px',
  collection: '(max-width: 760px) calc((100vw - 92px) / 2), (max-width: 1047px) calc((100vw - 120px) / 2), (max-width: 1387px) calc((100vw - 166px) / 3), 304px',
};
