import ExcelJS from 'exceljs';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { listRegistrations } from '@/server/manage/registrations';
import { formatPhone } from '@/server/registration/rules';
import { AppError } from '@/server/shared/errors';
import { formatDateTime } from '@/server/shared/time';
import { GENDER_LABEL, HAND_LABEL } from '@/server/tournaments/templates';
import { requireTournament } from '@/server/tournaments/service';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL('/dang-nhap', process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'));
  try {
    const t = await requireTournament(user.id, id);
    const rows = await listRegistrations(user.id, id);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Đăng ký');
    ws.columns = [
      { header: 'Mã', key: 'code', width: 12 },
      { header: 'Họ tên', key: 'name', width: 26 },
      { header: 'SĐT', key: 'phone', width: 15 },
      { header: 'Năm sinh', key: 'by', width: 10 },
      { header: 'Giới tính', key: 'gender', width: 10 },
      { header: 'CLB', key: 'club', width: 18 },
      { header: 'Hạng mục', key: 'cats', width: 34 },
      { header: 'Phải thu', key: 'due', width: 12 },
      { header: 'Đã thu', key: 'paid', width: 12 },
      { header: 'Thanh toán', key: 'pay', width: 14 },
      { header: 'Trạng thái', key: 'status', width: 12 },
      { header: 'Cân (kg)', key: 'kg', width: 10 },
      { header: 'Cảnh báo năm sinh', key: 'warn', width: 12 },
      { header: 'Nguồn', key: 'source', width: 10 },
      { header: 'Thời gian đăng ký', key: 'at', width: 20 },
    ];
    ws.getRow(1).font = { bold: true };
    const PAY: Record<string, string> = { paid: 'Đã đóng', partial: 'Đóng thiếu', unpaid: 'Chưa đóng', refunded: 'Đã hoàn' };
    const ST: Record<string, string> = { pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối', cancelled: 'Đã hủy' };
    for (const r of rows) {
      ws.addRow({
        code: r.code,
        name: r.athlete.fullName,
        phone: formatPhone(r.athlete.phone),
        by: r.athlete.birthYear,
        gender: r.athlete.gender === 'male' ? 'Nam' : 'Nữ',
        club: r.athlete.club ?? '',
        cats: r.entries.map((e) => `${HAND_LABEL[e.category.hand]} ${GENDER_LABEL[e.category.gender]} ${e.category.label}`).join('; '),
        due: r.amountDue,
        paid: r.amountPaid,
        pay: PAY[r.paymentStatus],
        status: ST[r.status],
        kg: r.weighedKg ? Number(r.weighedKg) : '',
        warn: r.ageWarning ? 'Có' : '',
        source: r.source === 'onsite' ? 'Tại sân' : 'Online',
        at: formatDateTime(r.createdAt),
      });
    }
    ws.getColumn('due').numFmt = '#,##0';
    ws.getColumn('paid').numFmt = '#,##0';
    const buf = await wb.xlsx.writeBuffer();
    return new NextResponse(buf as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="dang-ky-${t.slug}.xlsx"`,
      },
    });
  } catch (e) {
    if (e instanceof AppError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }
}
