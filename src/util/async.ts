export function delayMillis(millis: number) {
    return new Promise<void>(resolve => {
        setTimeout(resolve, millis);
    });
}
