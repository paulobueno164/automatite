import { computeNextRun } from './schedule';

describe('computeNextRun', () => {
  it('should correctly compute the next run for valid crons', () => {
    const from = new Date('2023-10-10T10:00:00Z');
    const tz = 'UTC';

    const nextRunHourly = computeNextRun('0 * * * *', from, tz);
    expect(nextRunHourly).toEqual(new Date('2023-10-10T11:00:00Z'));

    const nextRunDaily = computeNextRun('0 9 * * *', from, tz);
    expect(nextRunDaily).toEqual(new Date('2023-10-11T09:00:00Z'));
  });

  it('should return null for invalid crons', () => {
    expect(computeNextRun('invalid')).toBeNull();
    expect(computeNextRun('*/5 *')).toBeNull(); // Missing segments leading to error
    expect(computeNextRun('0 25 * * *')).toBeNull(); // Invalid hour
    expect(computeNextRun('60 * * * *')).toBeNull(); // Invalid minute
  });

  it('should use the provided from and tz parameters', () => {
    // If we are in 'America/Sao_Paulo', 9 AM is 12 PM UTC (during standard time)
    const from = new Date('2023-10-10T10:00:00Z'); // 7 AM BRT
    const tz = 'America/Sao_Paulo';

    // 9 AM BRT is 12 PM UTC
    const nextRunDaily = computeNextRun('0 9 * * *', from, tz);
    expect(nextRunDaily).toEqual(new Date('2023-10-10T12:00:00Z'));
  });

  it('should handle default from and tz parameters', () => {
    // Testing default parameters by just checking that it returns a valid Date
    const nextRun = computeNextRun('*/5 * * * *');
    expect(nextRun).toBeInstanceOf(Date);
  });
});
