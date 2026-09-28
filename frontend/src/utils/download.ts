// Сохранение файла, сформированного в браузере (шаблоны, выгрузки).

/**
 * Предлагает пользователю сохранить файл по object URL и освобождает URL.
 * URL должен быть получен через URL.createObjectURL и больше нигде не использоваться.
 */
export function saveObjectUrl(url: string, filename: string): void {
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Даём браузеру начать загрузку, прежде чем освободить ссылку.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** Предлагает пользователю сохранить blob под именем filename. */
export function saveBlob(blob: Blob, filename: string): void {
  saveObjectUrl(URL.createObjectURL(blob), filename)
}
