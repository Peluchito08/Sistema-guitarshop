import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

export type ExportRow = Record<string, string | number>

export const exportToCSV = (rows: ExportRow[], filenameBase: string) => {
	if (!rows || rows.length === 0) return
	const worksheet = XLSX.utils.json_to_sheet(rows)
	const csv = XLSX.utils.sheet_to_csv(worksheet, { FS: ";", RS: "\r\n" })
	const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" })
	const url = URL.createObjectURL(blob)
	const link = document.createElement("a")
	link.href = url
	link.download = `${filenameBase}.csv`
	link.click()
	URL.revokeObjectURL(url)
}

export const exportToXLSX = (rows: ExportRow[], filenameBase: string) => {
	if (!rows || rows.length === 0) return
	const worksheet = XLSX.utils.json_to_sheet(rows)
	const workbook = XLSX.utils.book_new()
	XLSX.utils.book_append_sheet(workbook, worksheet, "Productos")
	XLSX.writeFile(workbook, `${filenameBase}.xlsx`, { bookType: "xlsx" })
}

export const exportToPDF = (_rows: ExportRow[], _filenameBase: string) => {
	if (!_rows || _rows.length === 0) return

	const headers = Object.keys(_rows[0])
	const body = _rows.map((row) => headers.map((key) => {
		const value = row[key]
		return value === null || value === undefined ? "—" : String(value)
	}))

	const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" })
	const title = "Exportar productos"
	const now = new Date().toLocaleString("es-ES")

	doc.setFontSize(14)
	doc.text(title, 40, 32)
	doc.setFontSize(9)
	doc.text(now, 40, 48)

	autoTable(doc, {
		startY: 62,
		head: [headers],
		body,
		theme: "striped",
		styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
		headStyles: { fillColor: [15, 23, 42], textColor: 255 },
		margin: { left: 40, right: 40 },
	})

	doc.save(`${_filenameBase}.pdf`)
}
