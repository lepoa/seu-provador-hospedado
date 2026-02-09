/**
 * UTF-8 safe clipboard utilities
 * Ensures emojis and special characters are properly copied
 */

/**
 * Copy text to clipboard with proper UTF-8 encoding for emojis
 * Uses ClipboardItem API when available for better emoji support
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    // Modern approach with explicit UTF-8 blob for emoji support
    if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      await navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob })]);
      return true;
    }
    
    // Standard writeText fallback
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    
    // Legacy fallback using execCommand
    return copyWithExecCommand(text);
  } catch (error) {
    console.warn('Clipboard API failed, using fallback:', error);
    return copyWithExecCommand(text);
  }
}

/**
 * Legacy clipboard copy using execCommand
 * Works in older browsers and some edge cases
 */
function copyWithExecCommand(text: string): boolean {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  
  // Prevent scrolling to bottom
  textArea.style.cssText = `
    position: fixed;
    top: 0;
    left: -9999px;
    width: 1px;
    height: 1px;
    padding: 0;
    border: none;
    outline: none;
    box-shadow: none;
    background: transparent;
  `;
  
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  
  let success = false;
  try {
    success = document.execCommand('copy');
  } catch (err) {
    console.error('execCommand copy failed:', err);
  }
  
  document.body.removeChild(textArea);
  return success;
}
