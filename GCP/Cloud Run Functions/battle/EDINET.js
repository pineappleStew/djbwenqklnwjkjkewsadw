const fs = require('fs').promises;
const axios = require('axios');

const sub_key = "XXX";

//EDINET ドキュメントIDからPDFをダウンロード
async function downloadPdfFromDocID(docId) {
    const url = `https://disclosure.edinet-fsa.go.jp/api/v2/documents/${docId}`;
    const params = { type: 2, 'Subscription-Key': sub_key };

    try {
        const response = await axios.get(url, { params, responseType: 'arraybuffer' });

        if (response.status === 200) {
            const base64Pdf = Buffer.from(response.data).toString('base64');
            return base64Pdf;
        }
    } catch (error) {
        console.error(`Error downloading PDF: ${error.message}`);
    }
}

//企業一覧をロード
async function loadCompanyData(filePath) {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data).filtered_documents;
}

//2つの文字列の類似度を計算
function similarityRatio(a, b) {
    const maxLength = Math.max(a.length, b.length);
    let matches = 0;
    for (let i = 0; i < maxLength; i++) {
        if (a[i] === b[i]) matches++;
    }
    return matches / maxLength;
}

//入力文字列を全角に変換
function toFullWidth(str) {
    str = str.replace(/[A-Za-z0-9]/g, function(s) {
        return String.fromCharCode(s.charCodeAt(0) + 0xFEE0);
    });
    str = str.replaceAll("・","");
    return str;
}

//企業名からマッチする会社リストを取得
function findCompanyByName(companyName, companies) {
    const companyNameEdited = toFullWidth(companyName.toLowerCase());
    const pattern = new RegExp(companyNameEdited.split('').map(char => escapeRegExp(char)).join('.*'), 'i');

    const matchingCompanies = companies
        .filter(company => pattern.test(toFullWidth(company.filerName.toLowerCase())))
        .map(company => ({
            company,
            similarity: similarityRatio(companyNameEdited, toFullWidth(company.filerName.toLowerCase()))
        }))
        .sort((a, b) => b.similarity - a.similarity);

    const groupedCompanies = matchingCompanies.reduce((acc, { company, similarity }) => {
        const filerName = company.filerName;
        const periodEnd = new Date(company.periodEnd);

        if (!acc[filerName] || periodEnd > new Date(acc[filerName].company.periodEnd)) {
            acc[filerName] = { company, periodEnd, similarity };
        }
        return acc;
    }, {});

    return Object.values(groupedCompanies)
        .sort((a, b) => b.similarity - a.similarity)
        .map(({ company }) => company);
}

//特殊文字を削除
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

//企業一覧ファイルのロード、企業一覧の取得を実行
async function companyLookup(companyName) {
    const companies = await loadCompanyData('filtered_edinet_documents.json');
    return findCompanyByName(companyName, companies);
}

module.exports = {
    companyLookup,
    downloadPdfFromDocID,
};