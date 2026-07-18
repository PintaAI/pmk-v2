// Unit tests for analytics/date-validation helpers.
import { describe, it } from "node:test"
import * as assert from "node:assert/strict"
import { validateDateFilter } from "../../scripts/migration-lib"

describe("Analytics date validation", () => {
  it("accepts valid ISO dates", () => {
    const result = validateDateFilter({ from: "2026-01-01", to: "2026-06-30" })
    assert.ok(!("error" in result))
  })

  it("accepts from-date only", () => {
    const result = validateDateFilter({ from: "2026-01-01T00:00:00Z", to: null })
    assert.ok(!("error" in result))
    if (!("error" in result)) {
      assert.ok(result.fromDate instanceof Date)
      assert.equal(result.toDate, undefined)
    }
  })

  it("accepts to-date only", () => {
    const result = validateDateFilter({ from: null, to: "2026-06-30" })
    assert.ok(!("error" in result))
    if (!("error" in result)) {
      assert.equal(result.fromDate, undefined)
      assert.ok(result.toDate instanceof Date)
    }
  })

  it("rejects swappped dates", () => {
    const result = validateDateFilter({ from: "2026-12-31", to: "2026-01-01" })
    assert.ok("error" in result)
    assert.ok(result.error!.includes("before"))
  })

  it("rejects garbage input", () => {
    const result = validateDateFilter({ from: "garbage", to: "2026-01-01" })
    assert.ok("error" in result)
  })

  it("rejects partial only invalid from", () => {
    const result = validateDateFilter({ from: "%", to: null })
    assert.ok("error" in result)
  })

  it("returns empty result for no dates", () => {
    const result = validateDateFilter({ from: null, to: null })
    assert.ok(!("error" in result))
    if (!("error" in result)) {
      assert.equal(result.fromDate, undefined)
      assert.equal(result.toDate, undefined)
    }
  })

  it("handles same day from and to", () => {
    const result = validateDateFilter({ from: "2026-06-15", to: "2026-06-15" })
    assert.ok(!("error" in result))
  })

  it("handles datetime with timezone", () => {
    const result = validateDateFilter({ from: "2026-01-01T00:00:00+07:00", to: "2026-01-01T23:59:59+07:00" })
    assert.ok(!("error" in result))
  })
})

describe("Analytics number helpers", () => {
  function toNumber(value: unknown): number {
    if (value == null) return 0
    return Number(value)
  }

  function formatCurrencyCompact(value: number): string {
    if (value >= 1_000_000) {
      return `Rp${(value / 1_000_000).toFixed(1)}jt`
    }
    if (value >= 1_000) {
      return `Rp${(value / 1_000).toFixed(0)}rb`
    }
    return `Rp${value}`
  }

  it("converts valid numbers", () => {
    assert.equal(toNumber(100), 100)
    assert.equal(toNumber("500"), 500)
  })

  it("converts null/undefined to 0", () => {
    assert.equal(toNumber(null), 0)
    assert.equal(toNumber(undefined), 0)
  })

  it("formatCompact handles millions", () => {
    assert.ok(formatCurrencyCompact(1_500_000).includes("jt"))
  })

  it("formatCompact handles thousands", () => {
    assert.ok(formatCurrencyCompact(50_000).includes("rb"))
  })

  it("formatCompact handles small values", () => {
    assert.equal(formatCurrencyCompact(500), "Rp500")
  })

  it("formatCompact handles zero", () => {
    assert.equal(formatCurrencyCompact(0), "Rp0")
  })
})

describe("Month label generation", () => {
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

  function monthLabel(year: number, month: number): string {
    return `${monthNames[month - 1]} ${year}`
  }

  it("generates correct labels", () => {
    assert.equal(monthLabel(2026, 1), "Jan 2026")
    assert.equal(monthLabel(2026, 7), "Jul 2026")
    assert.equal(monthLabel(2026, 12), "Dec 2026")
  })
})

describe("Channel percentage calculation", () => {
  function channelPercentages(data: Array<{ channel: string; total: number; count: number }>) {
    const grandTotal = data.reduce((s, c) => s + c.total, 0)
    return data.map((c) => ({ ...c, percentage: grandTotal > 0 ? (c.total / grandTotal) * 100 : 0 }))
  }

  it("calculates percentages correctly", () => {
    const data = [
      { channel: "CASHIER", total: 600, count: 3 },
      { channel: "ONLINE", total: 400, count: 2 },
    ]
    const result = channelPercentages(data)
    assert.equal(result[0].percentage, 60)
    assert.equal(result[1].percentage, 40)
  })

  it("handles zero total", () => {
    const result = channelPercentages([{ channel: "A", total: 0, count: 0 }])
    assert.equal(result[0].percentage, 0)
  })

  it("handles empty", () => {
    const result = channelPercentages([])
    assert.deepEqual(result, [])
  })
})
