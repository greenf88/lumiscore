// Aggregate test evidence without printing fixture contents on successful runs.
export default async function* reporter(events) {
  for await (const event of events) {
    if (event.type === 'test:fail') yield `FAIL: ${event.data.name}\n`;
    if (event.type === 'test:summary' && !event.data.file) yield `${JSON.stringify(event.data)}\n`;
    if (event.type === 'test:stdout' && event.data.message.includes('syntheticWorks')) yield event.data.message;
  }
}
