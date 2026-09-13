// PostgREST can cap RPC results. Load stable pages before grouping/sorting;
// never present a partial directory as though it were complete.
export async function allSocialPages<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const rows: T[] = [];
  const size = 200;
  for (let from = 0; ; from += size) {
    const result = await fetchPage(from, from + size - 1);
    if (result.error || !result.data) return { data: null, error: result.error || new Error("Directory unavailable") };
    rows.push(...result.data);
    if (result.data.length === 0) return { data: rows, error: null };
    // Continue even after a short page: deployments may have a lower API row cap.
    from += result.data.length - size;
  }
}
