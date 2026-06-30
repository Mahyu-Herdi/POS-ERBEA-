function doPost(e) {
  var sheetId = "YOUR_SPREADSHEET_ID_HERE"; // Ganti dengan ID Spreadsheet Anda
  var doc = SpreadsheetApp.openById(sheetId);
  
  try {
    var data = JSON.parse(e.postData.contents);
    var type = data.type; 
    
    if (type === "SYNC_ALL") {
      var payload = data.payload;
      
      if (payload.toko) {
        var tokoSheet = getOrCreateSheet(doc, "Toko");
        tokoSheet.clear();
        tokoSheet.appendRow(["Nama Toko", "Logo Base64"]);
        tokoSheet.appendRow([payload.toko.nama || "", payload.toko.logoBase64 || ""]);
      }

      if (payload.transaksiList) {
        var txSheet = getOrCreateSheet(doc, "Transaksi");
        txSheet.clear();
        txSheet.appendRow(["Tgl", "TglRaw", "Tipe", "Ident", "Total", "Bayar", "Metode"]);
        var txData = payload.transaksiList.map(function(t) {
          return [t.tgl, t.tglRaw, t.tipe, t.ident, t.total, t.bayar, t.metode];
        });
        if (txData.length > 0) txSheet.getRange(2, 1, txData.length, txData[0].length).setValues(txData);
      }
      
      if (payload.stokData) {
        var stokSheet = getOrCreateSheet(doc, "Stok");
        stokSheet.clear();
        stokSheet.appendRow(["ID", "Nama", "Sisa", "Unit", "Harga Per Unit"]);
        var sData = payload.stokData.map(function(s) {
          return [s.id, s.nama, s.sisa, s.unit, s.hargaPerUnit];
        });
        if (sData.length > 0) stokSheet.getRange(2, 1, sData.length, sData[0].length).setValues(sData);
      }
      
      if (payload.menu) {
        var menuSheet = getOrCreateSheet(doc, "Menu");
        menuSheet.clear();
        menuSheet.appendRow(["ID", "Nama", "Harga", "Total Resep"]);
        var mData = payload.menu.map(function(m) {
          return [m.id, m.name, m.harga, m.resep ? m.resep.length : 0];
        });
        if (mData.length > 0) menuSheet.getRange(2, 1, mData.length, mData[0].length).setValues(mData);
      }
      
      if (payload.bebanAktif) {
        var asetSheet = getOrCreateSheet(doc, "BebanAset");
        asetSheet.clear();
        asetSheet.appendRow(["Nama", "Harga", "Umur (Bulan)"]);
        if (payload.bebanAktif.aset && payload.bebanAktif.aset.length > 0) {
          var aData = payload.bebanAktif.aset.map(function(a) { return [a.nama, a.harga, a.umur]; });
          asetSheet.getRange(2, 1, aData.length, aData[0].length).setValues(aData);
        }

        var opsSheet = getOrCreateSheet(doc, "BebanOps");
        opsSheet.clear();
        opsSheet.appendRow(["Nama", "Biaya Bulanan"]);
        if (payload.bebanAktif.ops && payload.bebanAktif.ops.length > 0) {
          var oData = payload.bebanAktif.ops.map(function(o) { return [o.nama, o.biaya]; });
          opsSheet.getRange(2, 1, oData.length, oData[0].length).setValues(oData);
        }

        var targetSheet = getOrCreateSheet(doc, "Target");
        targetSheet.clear();
        targetSheet.appendRow(["Target Porsi", payload.bebanAktif.target || 1000]);
      }
      
      if (payload.keuangan) {
        var keuSheet = getOrCreateSheet(doc, "Keuangan");
        keuSheet.clear();
        keuSheet.appendRow(["Masuk", "Keluar Op", "Keluar Stok", "Prive", "Modal Bahan", "HPP Terjual"]);
        var k = payload.keuangan;
        keuSheet.appendRow([k.masuk, k.keluarOp, k.keluarStok, k.prive, k.modalBahan, k.hppTerjual || 0]);
      }
      
      return ContentService.createTextOutput(JSON.stringify({status: "success"}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    else if (type === "PULL_ALL") {
      var res = {};
      // Fetch toko
      var tokoSheet = doc.getSheetByName("Toko");
      if (tokoSheet) {
        var tData = tokoSheet.getDataRange().getValues();
        if (tData.length > 1) res.toko = { nama: tData[1][0], logoBase64: tData[1][1] };
      }
      
      // Fetch stok
      var stokSheet = doc.getSheetByName("Stok");
      if (stokSheet) {
        var stData = stokSheet.getDataRange().getValues();
        res.stokData = [];
        for (var i = 1; i < stData.length; i++) {
          res.stokData.push({ id: stData[i][0], nama: stData[i][1], sisa: stData[i][2], unit: stData[i][3], hargaPerUnit: stData[i][4] });
        }
      }
      
      // Fetch menu
      var menuSheet = doc.getSheetByName("Menu");
      if (menuSheet) {
        var mData = menuSheet.getDataRange().getValues();
        res.menu = [];
        for (var j = 1; j < mData.length; j++) {
          res.menu.push({ id: mData[j][0], name: mData[j][1], harga: mData[j][2], resep: [] });
        }
      }
      
      // Fetch Beban
      res.bebanAktif = { aset: [], ops: [], target: 1000, perPorsi: 0 };
      var asetSheet = doc.getSheetByName("BebanAset");
      if (asetSheet) {
        var aData = asetSheet.getDataRange().getValues();
        for (var k = 1; k < aData.length; k++) {
          res.bebanAktif.aset.push({ nama: aData[k][0], harga: aData[k][1], umur: aData[k][2] });
        }
      }
      var opsSheet = doc.getSheetByName("BebanOps");
      if (opsSheet) {
        var oData = opsSheet.getDataRange().getValues();
        for (var l = 1; l < oData.length; l++) {
          res.bebanAktif.ops.push({ nama: oData[l][0], biaya: oData[l][1] });
        }
      }
      var targetSheet = doc.getSheetByName("Target");
      if (targetSheet) {
        var trData = targetSheet.getDataRange().getValues();
        if (trData.length > 0) res.bebanAktif.target = trData[0][1] || 1000;
      }
      
      // Fetch Keuangan
      var keuSheet = doc.getSheetByName("Keuangan");
      if (keuSheet) {
        var kData = keuSheet.getDataRange().getValues();
        if (kData.length > 1) {
          res.keuangan = {
            masuk: kData[1][0], keluarOp: kData[1][1], keluarStok: kData[1][2], 
            prive: kData[1][3], modalBahan: kData[1][4], hppTerjual: kData[1][5]
          };
        }
      }
      
      // Fetch Transaksi
      var txSheet = doc.getSheetByName("Transaksi");
      if (txSheet) {
        var txData = txSheet.getDataRange().getValues();
        res.transaksiList = [];
        for (var t = 1; t < txData.length; t++) {
          res.transaksiList.push({ tgl: txData[t][0], tglRaw: txData[t][1], tipe: txData[t][2], ident: txData[t][3], total: txData[t][4], bayar: txData[t][5], metode: txData[t][6] });
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({status: "success", data: res}))
        .setMimeType(ContentService.MimeType.JSON);
    }
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({status: "error", message: err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doOptions(e) {
  var headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet(doc, sheetName) {
  var sheet = doc.getSheetByName(sheetName);
  if (!sheet) {
    sheet = doc.insertSheet(sheetName);
  }
  return sheet;
}
