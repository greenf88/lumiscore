export function overviewScrollKey(path: string, query: string): string {
  const params = new URLSearchParams(query);
  for (const key of [...params.keys()]) if (params.get(key) === '') params.delete(key);
  const browse = /(?:^|\/)browse$/.test(path);
  for (const [key, value] of [['page','1'],['pageSize',browse ? '16' : '32'],['sort',browse ? 'highest' : 'az'],['limit','20']]) {
    if (params.get(key) === value) params.delete(key);
  }
  params.sort();
  return `lumiscore-scroll:${path}${params.size ? `?${params}` : ''}`;
}
