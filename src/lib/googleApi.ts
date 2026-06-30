export const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
export const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
export const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';

export async function getOrCreateAppFolder(token: string): Promise<string> {
  const query = encodeURIComponent("mimeType='application/vnd.google-apps.folder' and name='Smart POS Warkop Data' and trashed=false");
  let res = await fetch(`${DRIVE_API}?q=${query}`, { headers: { Authorization: `Bearer ${token}` } });
  let data = await res.json();
  
  if (data.error) throw new Error(data.error.message);

  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }
  
  res = await fetch(DRIVE_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Smart POS Warkop Data', mimeType: 'application/vnd.google-apps.folder' })
  });
  data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.id;
}

export async function findSpreadsheetInFolder(folderId: string, token: string): Promise<string | null> {
  const query = encodeURIComponent(`mimeType='application/vnd.google-apps.spreadsheet' and '${folderId}' in parents and trashed=false`);
  const res = await fetch(`${DRIVE_API}?q=${query}`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }
  return null;
}

export async function createSpreadsheet(title: string, folderId: string, token: string) {
  const res = await fetch(SHEETS_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: { title },
      sheets: [
        { properties: { title: 'Toko' } },
        { properties: { title: 'Menu' } },
        { properties: { title: 'Transaksi' } },
        { properties: { title: 'Aset' } }
      ]
    })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  
  // Move to folder
  await fetch(`${DRIVE_API}/${data.spreadsheetId}?addParents=${folderId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` }
  });
  
  return data.spreadsheetId;
}

export async function uploadLogoToDrive(file: File, folderId: string, token: string) {
  const metadata = {
    name: file.name,
    mimeType: file.type,
    parents: [folderId]
  };

  
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);
  
  const res = await fetch(`${DRIVE_UPLOAD}?uploadType=multipart`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: form
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.id;
}

export async function clearSheetData(spreadsheetId: string, range: string, token: string) {
  const res = await fetch(`${SHEETS_API}/${spreadsheetId}/values/${range}:clear`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data;
}

export async function updateSheetData(spreadsheetId: string, range: string, values: any[][], token: string) {
  const res = await fetch(`${SHEETS_API}/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      range,
      values
    })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data;
}

export async function getSheetData(spreadsheetId: string, range: string, token: string) {
  const res = await fetch(`${SHEETS_API}/${spreadsheetId}/values/${range}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.values;
}
