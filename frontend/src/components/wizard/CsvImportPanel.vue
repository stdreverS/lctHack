<script setup lang="ts">
import { computed, ref } from 'vue'
import { Download, Upload } from '@element-plus/icons-vue'
import type { ObjectType, Params } from '@/types/api'
import { buildCsvTemplate, parseParamsCsv, type CsvImportReport } from '@/utils/csvParams'
import { saveBlob } from '@/utils/download'

const MAX_FILE_BYTES = 1024 * 1024

const props = defineProps<{
  type: ObjectType
  /** Выделить панель: пользователь выбрал «Загрузить CSV» на шаге «Объект». */
  prominent: boolean
}>()

const emit = defineEmits<{ import: [params: Params] }>()

const fileInput = ref<HTMLInputElement>()
const fileName = ref('')
const report = ref<CsvImportReport | null>(null)
const readError = ref('')

const fieldCount = computed(() => props.type.fields.length)

function downloadTemplate() {
  const csv = buildCsvTemplate(props.type.fields)
  saveBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `шаблон-параметров-${props.type.code}.csv`)
}

async function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // чтобы повторный выбор того же файла снова сработал
  if (!file) return
  fileName.value = file.name
  report.value = null
  readError.value = ''
  if (file.size > MAX_FILE_BYTES) {
    readError.value = 'Файл больше 1 МБ — это не похоже на шаблон параметров. Скачайте шаблон CSV и заполните его.'
    return
  }
  try {
    report.value = parseParamsCsv(await file.text(), props.type.fields)
  } catch {
    readError.value = 'Не удалось прочитать файл. Сохраните его в Excel как «CSV UTF-8» и загрузите снова.'
    return
  }
  if (report.value.filled.length) emit('import', report.value.params)
}
</script>

<template>
  <section class="csv" :class="{ 'csv--prominent': prominent }" aria-labelledby="csv-title">
    <div class="csv__head">
      <div>
        <h3 id="csv-title" class="csv__title">Загрузка параметров из CSV</h3>
        <p class="csv__text">
          Скачайте шаблон, заполните столбец <code>value</code> в Excel и загрузите файл.
          Разделитель — «;» или «,», десятичная часть — через запятую или точку.
        </p>
      </div>
      <div class="csv__actions">
        <el-button :icon="Download" @click="downloadTemplate">Скачать шаблон CSV</el-button>
        <el-button :type="prominent ? 'primary' : 'default'" :icon="Upload" @click="fileInput?.click()">
          Загрузить CSV
        </el-button>
        <input ref="fileInput" type="file" accept=".csv,text/csv" hidden @change="onFile" />
      </div>
    </div>

    <div v-if="readError || report" class="csv__report" aria-live="polite">
      <el-alert v-if="readError" type="error" :closable="false" show-icon :title="readError" />
      <el-alert v-else-if="report?.fileError" type="error" :closable="false" show-icon :title="report.fileError" />
      <template v-else-if="report">
        <el-alert
          :type="report.filled.length ? 'success' : 'warning'"
          :closable="false"
          show-icon
          :title="`Файл «${fileName}»: заполнено полей — ${report.filled.length} из ${fieldCount}`"
        >
          <p v-if="!report.filled.length">Ни одно значение не подставлено. Проверьте столбцы key и value по шаблону.</p>
          <p v-else-if="report.filled.length < fieldCount">Остальные поля остались как были — проверьте их в форме ниже.</p>
        </el-alert>
        <el-alert
          v-if="report.unknownKeys.length"
          type="warning"
          :closable="false"
          show-icon
          title="Не распознаны ключи — эти строки пропущены"
        >
          <p>{{ report.unknownKeys.join(', ') }}</p>
          <p>Ключ в столбце key должен совпадать с шаблоном для этого типа объекта.</p>
        </el-alert>
        <el-alert
          v-if="report.invalid.length"
          type="warning"
          :closable="false"
          show-icon
          title="Значения не прошли проверку и не подставлены"
        >
          <ul class="csv__list">
            <li v-for="item in report.invalid" :key="item.key">
              <b>{{ item.label }}</b> (<code>{{ item.key }}</code>) = «{{ item.raw }}»: {{ item.message }}
            </li>
          </ul>
        </el-alert>
      </template>
    </div>
  </section>
</template>

<style scoped>
.csv {
  padding: var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.csv--prominent {
  border-color: var(--color-primary);
}

.csv__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

.csv__title {
  font-size: 16px;
  font-weight: 600;
}

.csv__text {
  max-width: 640px;
  margin-top: var(--space-1);
  color: var(--color-text-secondary);
}

.csv__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.csv__actions .el-button + .el-button {
  margin-left: 0;
}

.csv__report {
  display: grid;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.csv__list {
  padding-left: var(--space-4);
  list-style: disc;
}
</style>
