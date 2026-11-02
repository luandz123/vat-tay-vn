/** Ngân hàng phổ biến và mã BIN theo chuẩn VietQR (NAPAS). */
export const BANKS = [
  { bin: '970436', code: 'VCB', name: 'Vietcombank' },
  { bin: '970415', code: 'CTG', name: 'VietinBank' },
  { bin: '970418', code: 'BIDV', name: 'BIDV' },
  { bin: '970405', code: 'AGR', name: 'Agribank' },
  { bin: '970422', code: 'MB', name: 'MB Bank' },
  { bin: '970407', code: 'TCB', name: 'Techcombank' },
  { bin: '970416', code: 'ACB', name: 'ACB' },
  { bin: '970432', code: 'VPB', name: 'VPBank' },
  { bin: '970423', code: 'TPB', name: 'TPBank' },
  { bin: '970403', code: 'STB', name: 'Sacombank' },
  { bin: '970441', code: 'VIB', name: 'VIB' },
  { bin: '970437', code: 'HDB', name: 'HDBank' },
  { bin: '970426', code: 'MSB', name: 'MSB' },
  { bin: '970443', code: 'SHB', name: 'SHB' },
  { bin: '970448', code: 'OCB', name: 'OCB' },
  { bin: '970440', code: 'SEAB', name: 'SeABank' },
  { bin: '970431', code: 'EIB', name: 'Eximbank' },
  { bin: '970449', code: 'LPB', name: 'LPBank' },
] as const;

export const bankName = (bin: string | null | undefined) => BANKS.find((b) => b.bin === bin)?.name ?? null;
