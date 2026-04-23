export function exportToCSV(data: Record<string, any>[], filename: string) {
    if (!data.length) return;
  
    const headers = Object.keys(data[0]);
  
    const csv = [
      headers,
      ...data.map((row) => headers.map((h) => row[h])),
    ]
      .map((r) => r.map((cell) => `"${cell ?? ''}"`).join(';'))
      .join('\n');
  
    const bom = '\uFEFF';
    const sep = 'sep=;\n';
  
    const blob = new Blob([bom + sep + csv], {
      type: 'application/vnd.ms-excel;charset=utf-8;',
    });
  
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
  
    link.href = url;
    link.download = `${filename}.csv`;
    link.click();
  
    URL.revokeObjectURL(url);
  }