/**
 * Converts a text string to Base64.
 *
 * @param {string} input The string to convert.
 * @return The Base64 encoded string.
 * @customfunction
 */
function BASE64ENCODE(input) {
  if (input == "" || input == null) {
    return "";
  }
  // Convert string to bytes using UTF-8, then encode
  var bytes = Utilities.newBlob(input).getBytes();
  return Utilities.base64Encode(bytes);
}