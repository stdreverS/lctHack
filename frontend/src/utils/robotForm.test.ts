import { describe, expect, it } from 'vitest'
import type { Robot } from '@/types/api'
import {
  ROBOT_FORM_FIELDS,
  emptyRobotForm,
  formToRobotInput,
  robotToForm,
  searchRobots,
  serverFieldToFormKey,
  validateRobotForm,
  type RobotForm,
} from './robotForm'

const robot: Robot = {
  id: 'r1', name: 'Логимов AMR-600', manufacturer: 'Логимов Роботикс',
  solutionType: 'amr', solutionTypeName: 'AMR — автономный мобильный робот', objectTypes: ['warehouse'],
  country: 'Россия', availability: null,
  price: 4_200_000, raasMonthlyPrice: null, maintenancePerYear: 320_000,
  specs: { payloadKg: 600, speedMps: 1.5, navigation: 'Лидар', lifeYears: 7 },
  sourceUrl: 'https://example.com/amr', sourceDate: '2026-06-15', confirmed: true,
}

const TODAY = new Date(2026, 8, 23)

function valid(): RobotForm {
  return robotToForm(robot)
}

describe('robotToForm / formToRobotInput', () => {
  it('туда и обратно без потерь; отсутствующие характеристики — null', () => {
    const input = formToRobotInput(robotToForm(robot))
    const { id: _id, ...rest } = robot
    expect(input).toEqual({
      ...rest,
      specs: {
        payloadKg: 600, speedMps: 1.5, perfOpsPerHour: null, autonomyH: null, chargeTimeH: null, positioningMm: null,
        navigation: 'Лидар', minAisleM: null, widthM: null, lengthM: null, heightM: null, lifeYears: 7,
      },
    })
  })

  it('обрезает пробелы, пустые строки → null', () => {
    const input = formToRobotInput({ ...valid(), name: '  Робот  ', country: '   ', navigation: '' })
    expect(input.name).toBe('Робот')
    expect(input.country).toBeNull()
    expect(input.specs.navigation).toBeNull()
  })
})

describe('validateRobotForm', () => {
  it('заполненная форма без ошибок', () => {
    expect(validateRobotForm(valid(), TODAY)).toEqual({})
  })

  it('пустая форма: обязательные поля', () => {
    const errors = validateRobotForm(emptyRobotForm(), TODAY)
    expect(Object.keys(errors).sort()).toEqual(
      ['maintenancePerYear', 'manufacturer', 'name', 'objectTypes', 'price', 'solutionType', 'solutionTypeName'].sort(),
    )
    expect(errors.price).toBe('Заполните поле «Цена покупки»')
  })

  it('диапазоны и целые числа', () => {
    const errors = validateRobotForm({ ...valid(), speedMps: 25, price: 0, lifeYears: 7.5, maintenancePerYear: 0 }, TODAY)
    expect(errors.speedMps).toBe('Значение должно быть от 0,05 до 10 м/с')
    expect(errors.price).toMatch(/^Значение должно быть от 1 до/)
    expect(errors.lifeYears).toBe('Введите целое число от 1 до 30 лет')
    expect(errors.maintenancePerYear).toBeUndefined()
  })

  it('код типа решения, ссылка, дата', () => {
    const errors = validateRobotForm(
      { ...valid(), solutionType: 'AMR робот', sourceUrl: 'example.com', sourceDate: '2026-12-01' },
      TODAY,
    )
    expect(errors.solutionType).toMatch(/латинские/)
    expect(errors.sourceUrl).toMatch(/https:\/\//)
    expect(errors.sourceDate).toBe('Дата данных не может быть в будущем')
  })

  it('«подтверждено» требует источник и дату', () => {
    const errors = validateRobotForm({ ...valid(), sourceUrl: '', sourceDate: '' }, TODAY)
    expect(errors.sourceUrl).toMatch(/подтверждённых/)
    expect(errors.sourceDate).toMatch(/подтверждённых/)
    expect(validateRobotForm({ ...valid(), sourceUrl: '', sourceDate: '', confirmed: false }, TODAY)).toEqual({})
  })

  it('длина текста', () => {
    expect(validateRobotForm({ ...valid(), name: 'x'.repeat(201) }, TODAY).name).toMatch(/200/)
  })
})

describe('serverFieldToFormKey', () => {
  it('имя поля API → ключ формы', () => {
    expect(serverFieldToFormKey('price')).toBe('price')
    expect(serverFieldToFormKey('specs.payloadKg')).toBe('payloadKg')
    expect(serverFieldToFormKey('unknown')).toBeNull()
  })

  it('у каждого поля формы уникальный путь API', () => {
    const paths = ROBOT_FORM_FIELDS.map((f) => f.path)
    expect(new Set(paths).size).toBe(paths.length)
  })
})

describe('searchRobots', () => {
  const list = [
    { name: 'Логимов AMR-600', manufacturer: 'Логимов Роботикс', solutionTypeName: 'AMR' },
    { name: 'ФМР-16', manufacturer: 'СеверТех', solutionTypeName: 'FMR — погрузчик' },
  ]
  it('ищет по всем словам в названии, производителе и типе', () => {
    expect(searchRobots(list, 'северТЕХ погрузчик')).toEqual([list[1]])
    expect(searchRobots(list, 'amr')).toEqual([list[0]])
    expect(searchRobots(list, '  ')).toEqual(list)
    expect(searchRobots(list, 'нет такого')).toEqual([])
  })
})
