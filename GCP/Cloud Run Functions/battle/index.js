const functions = require('@google-cloud/functions-framework');
const {VertexAI} = require('@google-cloud/vertexai');
const axios = require('axios');

const apiKey = "XXX"//process.env.AZURE_OPENAI_API_KEY;
const endpoint = "XXX"//process.env.AZURE_OPENAI_ENDPOINT;
const imageModel = "DALLE";
const dallE3APIVersion = "2024-02-01"//process.env.AZURE_OPENAI_VERSION;
const aoaiHeader = {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      };

const { companyLookup, downloadPdfFromDocID } = require('./EDINET');

//vertex AI連携初期化
const vertex_ai = new VertexAI({project: 'XXX', location: 'us-central1'});
const model = 'gemini-1.5-flash-001';//'gemini-1.5-flash-001';'gemini-1.5-pro-001'

//会社詳細を会社名から取得。EDINET.jsの関数を呼び出している。
async function getProperCompany(company1Name, company2Name){
  const [company1Details, company2Details] = await Promise.all([
        companyLookup(company1Name),
        companyLookup(company2Name)
  ]);
  return [
    company1Details[0],
    company2Details[0]
  ];
}

//Geminiモデルを呼ぶための関数。グローバル変数でモデルを指定する。
async function callGemini1_5Pro(systemPrompt, userPrompt, documents) {
  // Instantiate the models
    const generativeModel = vertex_ai.preview.getGenerativeModel({
    model: model,
    generationConfig: {
        'maxOutputTokens': 8192,
        'temperature': 1,
        'topP': 0.95,
    },
    safetySettings: [
        {
            'category': 'HARM_CATEGORY_HATE_SPEECH',
            'threshold': 'BLOCK_MEDIUM_AND_ABOVE'
        },
        {
            'category': 'HARM_CATEGORY_DANGEROUS_CONTENT',
            'threshold': 'BLOCK_MEDIUM_AND_ABOVE'
        },
        {
            'category': 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            'threshold': 'BLOCK_MEDIUM_AND_ABOVE'
        },
        {
            'category': 'HARM_CATEGORY_HARASSMENT',
            'threshold': 'BLOCK_MEDIUM_AND_ABOVE'
        }
    ],
    systemInstruction: {
        parts: [{"text": systemPrompt}]
    },
    });
  
  documents = documents.map(base64pdf => (
  {
    inlineData: {
      mimeType: 'application/pdf',
      data: base64pdf,
    }
  }));

  const parts = documents.concat([{text: userPrompt}]);
  console.log(parts)

  const req = {
    contents: [
      {role: 'user', parts: parts}
    ],
  };

  const res = await generativeModel.generateContent(req);

  return res.response.candidates[0].content.parts[0].text;
}

//画像生成用にDallE3を呼び出す関数
async function callAOAIDallE3(prompt) {
  //return '/assets/images/icons/error1.png';
  const url = `${endpoint}/openai/deployments/${imageModel}/images/generations?api-version=${dallE3APIVersion}`;

  const body = {
    "prompt": prompt,
    "size": "1024x1024", 
    "n": 1,
    "quality": "standard", 
    "style": "vivid"
  }
  try {
    const response = await axios.post(url, body, { headers: aoaiHeader });

    console.log('callAOAIDallE3 response:', response);

    return response.data.data[0].url;
  } catch (error) {
    console.error('callAOAIDallE3 error', error);
    return '/assets/images/icons/error1.png';
  }
}

//タグの間の文字を抽出する関数。１つの回答で複数の内容について生成しており、その内容ごとに特定のタグで囲っているため。
function extractBetweenTags(inputString, startTag, endTag, includeTag=true, errorText="処理エラー") {
  try {
    const escapedStartTag = startTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedEndTag = endTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const regex = new RegExp(`${escapedStartTag}(.*?)${escapedEndTag}`, 's');

    const match = inputString.match(regex);
    if(match){
      return includeTag ? startTag+match[1]+endTag : match[1];
    }else{
      return null;
    }
  } catch(error) {
    console.error('extractBetweenTags error', error);
    return errorText;
  }
}

//会社情報に関する回答部分をとってくる関数。
function extractAllCompanyInfoFromText(baseText, companyName){
  var statNum = extractBetweenTags(baseText, `|${companyName}statNum|`, `|${companyName}statNum|`, false);
  var statNum = extractBetweenTags(statNum, `[`, `]`, true, "[0, 0, 0, 0, 0]");
  const statReason = extractBetweenTags(baseText, `|${companyName}statReason|`, `|${companyName}statReason|`, false);
  const imagePrompt = extractBetweenTags(baseText, `|${companyName}imagePrompt|`, `|${companyName}imagePrompt|`, false);
  return {
    "statReason": statReason,
    "statNum": statNum,
    "imagePrompt": imagePrompt,
  };
};

//LLMの回答の全ての情報を保持する変数の初期化と、会社情報の追加。
function extractAllDataFromText(baseText, companyList){
  var allData = {
    companyInfo: [],
    battleResult: '',
    advice: '',
  };
  for (let companyName of companyList) {
    allData.companyInfo.push(extractAllCompanyInfoFromText(baseText, companyName));
  };
  return allData;
};

// Functionsフレームワークを使いHTTP関数を登録
functions.http('compareCompanies', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  var { company1, company2, battlefield } = req.body;

  //必要なパラメータが送信されているか確認
  if (!company1 || !company2 || !battlefield) {
    res.status(400).json({
      error: 'Missing required parameters: company1, company2, battlefield',
    });
    return;
  }

  //入力された企業名から会社の詳細を取得
  const [company1Details, company2Details] = await getProperCompany(company1, company2);
  console.log(company1Details, company2Details);
  company1 = company1Details.filerName;
  company2 = company2Details.filerName;

  //企業ごとに有価証券報告書PDFダウンロード
  const [company1PDFbase64, company2PDFbase64] = await Promise.all([
    downloadPdfFromDocID(company1Details.docID),
    downloadPdfFromDocID(company2Details.docID)
  ]);
  console.log("comapny1:", company1PDFbase64.slice(0, 100) + "...");
  console.log("comapny2:", company2PDFbase64.slice(0, 100) + "...");

  //システムプロンプト設定
  const systemPromptCompanyStats = 
  `あなたはとても優秀な企業コンサルタントです。ここではcompany1は${company1}、company2は${company2}とします。ただし、"company1"や"company2"といった単語はタグのみに使用し、回答にはそれらが示す本当の会社名を入れてください。プロンプトで指定されたタグ以外は付けないでください。
  1つ目のPDFは${company1}の${company1Details.periodEnd}までの情報を含んだ有価証券報告書、2つ目のPDFは${company1}の${company2Details.periodEnd}までの情報を含んだ有価証券報告書です。これらの情報も参考にしてください。
  回答にはそれぞれの会社特有のサービス、歴史、ニュース、製品、スローガン、業績の数値などを絶対に入れてください。
  ただし、|タグ名|などのタグは絶対に**|タグ名|**のようなマークダウン形式にしないでください。|タグ名|のまま出力してください。`;

  //ユーザープロンプト設定
  const userPromptCompanyStats =
`
${company1}と${company2}の情報をもとに、企業イメージを怪獣としてそれぞれに対しステータス数値設定と、その数値にした理由を出力してください。理由はステータスごとに段落にして説明してください。段落の間には必ず空の行を入れてください。
PDFなどから会社特有のサービス、歴史、ニュース、製品、スローガン、業績の数値などを絶対に入れてください。バトルはステータスの数字よりも、会社の現実の特長を重要視してください。
ステータスの説明エリア全体は特別な文字列を始めと終わりに入れ、囲ってください。${company1}は|company1statReason|、${company2}は|company2statReason|で絶対に囲んでください。具体的には、以下の「理想のステータスの説明」のようにしてください。
理想のステータスの説明：
"
|company1statReason|
*   **HP　財務指標（BS）:** 
    *   理由：
*   **ちから　財務指標（PL）:** 
    *   理由：
*   **かしこさ　知的資本：**
    *   理由：
*   **回避　ガバナンス：** 
    *   理由：
*   **丈夫さ　エンゲージメント：**
    *   理由：
|company1statReason|
"
ステータスは以下を参考に決めてください。ステータスは1-1000の間にしてください。
HP...企業の体力（ライフ）を意味します。→財務指標（BS）
ちから…物理的な攻撃力を表し、高いと相手のライフを大きく削ることができます。　→財務指標（PL）
かしこさ…精神的な攻撃力を表し、高いと相手のライフを大きく削ることができます。→知的資本
回避…攻撃の回避率を表し、高いと相手の攻撃を避けやすくなります。→ガバナンス
丈夫さ…防御力を表し、高いと攻撃を受けてもライフが減りづらくなります。　→エンゲージメント

HP、ちから、かしこさ、回避、丈夫さの数値は最後にこの順番で以下のように[]と数字のみ出力してください。必ず出力してください。
このエリアは${company1}は|company1statNum|、${company2}は|company2statNum|で絶対に囲ってください。
以下の「ステータスの書式」の形式に従ってください。
ステータスの書式：
"
|company1statNum|[1000, 500, 600, 230, 700]|company1statNum|
"

追加で上記のステータスを元にそれぞれの会社のキャラクターイメージを作ります。この画像を作るためのdalleプロンプトを作成してください。
会社の特長を入れたきれいな画像にしてください。ただし、会社名や製品などの固有名詞は絶対に入れないでください。場所は${battlefield}にしてください。
憎悪、自傷行為、性的内容、暴力、不快な表現は絶対に入れないでください。
プロンプトに会社名は絶対に入れないでください。このエリアは${company1}は|company1imagePrompt|、${company2}は|company2imagePrompt|で絶対に囲ってください。

企業情報と設定したステータスを元に${company1}と${company2}両戦士を${battlefield}を戦場としてバトルで戦わせてください。バトルをする際はステータスだけでなく、会社の分野、製品、特長を文章内に多く入れてください。バトルの経緯は具体的に、詳しく、そして必ず勝敗を決するようにしてください。可能であればマークダウン形式で記載してください。
バトルはステータスに基づいて攻撃、防御、体力の更新、特殊スキル発動などを繰り返すターン制にしてください。攻撃や防御は必ず現実の特長や製品と結び付けてください。バトル経過は論理的に筋が通っていることを確認してください。
日本語で答えてください。（バトルの過程全てとバトル結果）の開始場所と終了場所に|battleDetails|と記載してください。無駄な空白は入れないでください。会社名はそれぞれcompany1などではなく実際の名前で書いてください。
バトルは10ターンより長くはしないでください。

バトルで負けてしまった戦士に次回勝つためのアドバイスを具体的に、詳しく記載してください。アドバイスは現実の会社に適応できるような、戦略や方向性などの内容にしてください。アドバイスは|advice|で絶対に囲ってください。可能であればマークダウン形式で記載してください。日本語で答えてください。

`;

  try {
    //geminiからの返答を記録
    const gptRes = await callGemini1_5Pro(systemPromptCompanyStats, userPromptCompanyStats, [company1PDFbase64, company2PDFbase64]);
    var fullGptText = gptRes;
    console.log('fullGptTextStatus', fullGptText);

    //回答の文章から情報を抽出、変数に記録
    const allData = extractAllDataFromText(fullGptText, ["company1", "company2"]);
    
    //DallE3のプロンプトに追加する文言
    const dontEditPromptOrder = ' I NEED to test how the tool works with extremely simple prompts. DO NOT add any detail, just use it AS-IS';

    //企業の画像生成
    const [company1imageUrl, company2imageUrl] = await Promise.all([
      callAOAIDallE3(allData.companyInfo[0].imagePrompt+dontEditPromptOrder),
      callAOAIDallE3(allData.companyInfo[1].imagePrompt+dontEditPromptOrder),
    ]);
    const fullGptTextBattle = fullGptText;
    console.log('fullGptTextBattle', fullGptTextBattle);

    //返信用にデータ設定
    delete allData.companyInfo[0].imagePrompt;
    delete allData.companyInfo[1].imagePrompt;
    allData.companyInfo[0].imageUrl = company1imageUrl;
    allData.companyInfo[0].name = company1;
    allData.companyInfo[0].base64PDF = company1PDFbase64;
    allData.companyInfo[1].imageUrl = company2imageUrl;
    allData.companyInfo[1].name = company2;
    allData.companyInfo[1].base64PDF = company2PDFbase64;

    allData.battleResult = extractBetweenTags(fullGptTextBattle, `|battleDetails|`, `|battleDetails|`, false);
    allData.advice = extractBetweenTags(fullGptTextBattle, `|advice|`, `|advice|`, false);

    console.log('allData', allData);

    //フロントに回答返送
    res.json(allData);
  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: 'compareCompanies error',
    });
  }
});
