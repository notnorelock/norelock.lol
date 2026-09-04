import { For } from 'solid-js';

/** Mirrors TrackRow's grid so the list doesn't shift when real rows arrive. */
export function TrackRowSkeleton(props: { rows?: number }) {
  const widths = [58, 44, 67, 39, 52, 61, 47];

  return (
    <div class="track-list" aria-hidden="true">
      <For each={Array.from({ length: props.rows ?? 5 })}>
        {(_, index) => (
          <article class="track-row is-skeleton">
            <div class="track-cover">
              <div class="skeleton cover-skeleton" />
            </div>

            <div class="track-body">
              <div class="track-head">
                <div class="skeleton skeleton-line" style={{ width: `${widths[index() % widths.length]}%` }} />
                <div class="skeleton skeleton-line skeleton-meta" />
              </div>
              <div class="skeleton skeleton-wave" />
            </div>

            <div class="skeleton skeleton-download" />
          </article>
        )}
      </For>
    </div>
  );
}
