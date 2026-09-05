export async function withRequestDeadline<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  milliseconds = 30_000,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(controller.signal),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error('요청 시간이 초과되었습니다. 같은 인증 주소로 입금 확인을 다시 시도해 주세요. / Request timed out. Retry checking the same verification address.'));
          controller.abort();
        }, milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
