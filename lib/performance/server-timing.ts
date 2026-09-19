type DataClass = 'public' | 'private' | 'mixed';

export async function measureServerOperation<T>(
  operation: string,
  dataClass: DataClass,
  task: () => Promise<T>,
): Promise<T> {
  const startedAt = performance.now();
  let success = false;
  try {
    const result = await task();
    success = true;
    return result;
  } finally {
    console.info(JSON.stringify({
      event: 'server_operation_duration',
      operation,
      dataClass,
      durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
      success,
    }));
  }
}
