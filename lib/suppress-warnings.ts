// lib/suppress-warnings.ts
// Suppress specific console warnings in development

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  const shouldSuppressMessage = (args: any[]) => {
    const messageStr = String(args.join(' '));
    return (
      messageStr.includes('Skipping auto-scroll') ||
      messageStr.includes('shouldSkipElement') ||
      messageStr.includes('layout-router') ||
      messageStr.includes('sticky') ||
      messageStr.includes('fixed') ||
      messageStr.includes('Missing `Description`') ||
      messageStr.includes('Missing `Title`') ||
      messageStr.includes('aria-describedby') ||
      messageStr.includes('DialogContent') ||
      messageStr.includes('{DialogContent}')
    );
  };

  // Store original console methods
  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;

  // Override console methods with immediate execution
  console.log = function(...args: any[]) {
    if (shouldSuppressMessage(args)) return;
    originalConsoleLog.apply(console, args);
  };

  console.warn = function(...args: any[]) {
    if (shouldSuppressMessage(args)) return;
    originalConsoleWarn.apply(console, args);
  };

  console.error = function(...args: any[]) {
    if (shouldSuppressMessage(args)) return;
    originalConsoleError.apply(console, args);
  };

  // Also intercept console.info and console.debug
  const originalConsoleInfo = console.info;
  const originalConsoleDebug = console.debug;

  console.info = function(...args: any[]) {
    if (shouldSuppressMessage(args)) return;
    originalConsoleInfo.apply(console, args);
  };

  console.debug = function(...args: any[]) {
    if (shouldSuppressMessage(args)) return;
    originalConsoleDebug.apply(console, args);
  };

  // Override the console methods on error objects
  const originalError = window.Error;
  window.Error = function(...args: any[]) {
    const error = new originalError(...args);
    const originalStack = error.stack;

    Object.defineProperty(error, 'stack', {
      get() {
        if (originalStack && originalStack.includes('Skipping auto-scroll')) {
          return '';
        }
        return originalStack;
      }
    });

    return error;
  } as any;
  window.Error.prototype = originalError.prototype;
}

export {};
