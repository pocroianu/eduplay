import { describe, expect, it } from 'vitest'
import { getWindowsListeningPids } from '../../../scripts/dev-readiness.mjs'

describe('Windows development port detection', () => {
  it('does not mistake ports 30000 and 30001 for port 3000', () => {
    const output = `
  TCP    127.0.0.1:30000    0.0.0.0:0    LISTENING    42096
  TCP    127.0.0.1:30001    0.0.0.0:0    LISTENING    40208
`
    expect(getWindowsListeningPids(output, 3000)).toEqual([])
  })

  it('returns only exact local TCP listeners and deduplicates IPv4/IPv6 PIDs', () => {
    const output = `
  Proto  Local Address    Foreign Address    State    PID
  TCP    0.0.0.0:3000    0.0.0.0:0    LISTENING    1234
  TCP    [::]:3000    [::]:0    LISTENING    1234
  TCP    127.0.0.1:3000    0.0.0.0:0    LISTENING    5678
  TCP    127.0.0.1:30001    0.0.0.0:0    LISTENING    9999
  TCP    127.0.0.1:50000    127.0.0.1:3000    ESTABLISHED    5555
  UDP    0.0.0.0:3000    *:*    4444
`
    expect(getWindowsListeningPids(output, 3000)).toEqual([1234, 5678])
  })

  it('handles empty or failed netstat output', () => {
    expect(getWindowsListeningPids('', 3000)).toEqual([])
    expect(getWindowsListeningPids(null, 3000)).toEqual([])
  })
})
