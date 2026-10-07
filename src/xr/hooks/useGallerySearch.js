import { useCallback, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchSearch } from '../../state/actions';
import {
  getSearchAnnotationsForCompanionWindow,
  getSearchForWindow,
  getSearchIsFetching,
  getSearchQuery,
} from '../../state/selectors';
import { searchHits } from '../lib/gallerySearch';

// Mirador keeps searches per window and companion window; the gallery's are its own
export const XR_SEARCH = 'xr-search';

/**
 * IIIF Content Search across every searchable book in the gallery, through
 * Mirador's search actions and state: one search per book's service, all
 * under the XR window. Results are hits, in book and page order, each with
 * the spread it's on and its region on the page.
 *
 * @returns {{ fetching, hits, query, search, searchable }} `search(query)` runs one
 */
export function useGallerySearch({ books, windowId }) {
  const dispatch = useDispatch();
  const props = { companionWindowId: XR_SEARCH, windowId };
  const [ran, setRan] = useState(false);
  const query = useSelector((state) => getSearchQuery(state, props));
  const fetching = useSelector((state) => getSearchIsFetching(state, props));
  const responses = useSelector((state) => getSearchForWindow(state, { windowId })?.[XR_SEARCH]?.data);
  const annotations = useSelector((state) => getSearchAnnotationsForCompanionWindow(state, props));
  const searchable = useMemo(() => books.filter(({ searchService }) => searchService), [books]);

  const search = useCallback(
    (text) => {
      const words = text.trim();
      if (!words) return;
      setRan(true);
      searchable.forEach(({ searchService }) =>
        dispatch(fetchSearch(windowId, XR_SEARCH, `${searchService}?${new URLSearchParams({ q: words })}`, words)),
      );
    },
    [dispatch, searchable, windowId],
  );

  const hits = useMemo(
    () => (ran && responses ? searchHits(books, Object.values(responses), annotations?.resources ?? []) : []),
    [annotations, books, ran, responses],
  );

  return { fetching: ran && fetching, hits, query: ran ? query : '', search, searchable: searchable.length > 0 };
}
