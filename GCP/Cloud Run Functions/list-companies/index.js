const functions = require('@google-cloud/functions-framework');
//EDINET.jsからedinet処理関係の関数読み込み
const { companyLookup } = require('./EDINET');

// Functionsフレームワークを使いHTTP関数を登録
functions.http('listCompanies', async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
    }

    console.log("req", req);
    
    var { companyName } = req.body;

    console.log("companyName", companyName);

    //候補の企業の詳細情報リストを取得
    const potentialCompanies = await companyLookup(companyName);
    console.log("potentialCompanies", potentialCompanies)
    //詳細情報リストから企業名のみ抽出
    const potentialCompanyNames = await potentialCompanies.map(companyDetails => companyDetails.filerName);

    console.log("potentialCompanyNames", potentialCompanyNames)

    //データ返答
    res.json(potentialCompanyNames)

    //res.send(`Hello World!`);
});
