// Browser-only file download, shared by the CSV export and the backup.
// Everything stays in the browser: a Blob and a temporary `<a download>`.

/**
 * Downloads `content` as a file. The object URL is revoked after the click
 * has been handled, so Safari and mobile browsers still get the file.
 */
export function downloadTextFile(
  content: string,
  fileName: string,
  type: string,
): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
