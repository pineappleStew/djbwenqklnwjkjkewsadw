<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-grid>
          <ion-row>
            <ion-title>ファイナンスファイター2 - Finance Fighter 2</ion-title>
            <ion-col class="ion-text-end">
              <p>※EDINET APIの情報を元に生成しています。</p>
              <p>※結果はAIが生成したものです。情報を参考にする前に正しいか確認してください。</p>
            </ion-col>
          </ion-row>
        </ion-grid>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div class="main-container">
        <ion-item>
          <ion-label position="stacked">企業1の検索</ion-label>
          <ion-input
            v-model="company1Input"
            @ionChange="onInputChange(1, $event)"
            @compositionend="onCompositionEnd(1, $event)"
            class="company-input"
          ></ion-input>
        </ion-item>
        <div class="company-list-container">
          <ion-list v-if="companyList1.length > 0" class="company-list">
            <ion-item v-for="company in companyList1" :key="company" @click="selectCompany(1, company)" button>
              <ion-label>{{ company }}</ion-label>
            </ion-item>
          </ion-list>
          <div v-if="isLoading1" class="loading-indicator">
            <ion-spinner name="dots"></ion-spinner>
          </div>
        </div>
        <ion-item v-if="company1">
          <ion-label>選択された企業1：</ion-label>
          <ion-chip>
            <ion-label>{{ company1 }}</ion-label>
            <ion-icon :icon="closeCircle" @click="clearSelectedCompany(1)"></ion-icon>
          </ion-chip>
        </ion-item>

        <ion-item>
          <ion-label position="stacked">企業2の検索</ion-label>
          <ion-input
            v-model="company2Input"
            @ionChange="onInputChange(2, $event)"
            @compositionend="onCompositionEnd(2, $event)"
            class="company-input"
          ></ion-input>
        </ion-item>
        <div class="company-list-container">
          <ion-list v-if="companyList2.length > 0" class="company-list">
            <ion-item v-for="company in companyList2" :key="company" @click="selectCompany(2, company)" button>
              <ion-label>{{ company }}</ion-label>
            </ion-item>
          </ion-list>
          <div v-if="isLoading2" class="loading-indicator">
            <ion-spinner name="dots"></ion-spinner>
          </div>
        </div>
        <ion-item v-if="company2">
          <ion-label>選択された企業2：</ion-label>
          <ion-chip>
            <ion-label>{{ company2 }}</ion-label>
            <ion-icon :icon="closeCircle" @click="clearSelectedCompany(2)"></ion-icon>
          </ion-chip>
        </ion-item>

        <ion-item>
          <ion-label class="battlefield-label">戦場</ion-label>
          <ion-select v-model="selectedBattlefield" interface="popover" class="battlefield-select">
            <ion-select-option v-for="battlefield in battlefields" :key="battlefield" :value="battlefield">
              {{ battlefield }}
            </ion-select-option>
          </ion-select>
        </ion-item>

        <ion-button expand="block" @click="startBattle" :disabled="!company1 || !company2 || !selectedBattlefield || isLoading" id="battle-button">
          バトル開始
        </ion-button>
        <!-- <ion-popover trigger="battle-button" trigger-action="hover">
          <ion-content class="ion-padding">Hello World!</ion-content>
        </ion-popover> -->

        <div v-if="isLoading" class="loading-container">
          <ion-spinner name="crescent"></ion-spinner>
          <p>バトル準備中...</p>
        </div>

        <div v-if="battleStarted && !isLoading">
          <h2>戦士情報</h2>
          <ion-grid>
            <ion-row class="card-row">
              <ion-col size="12" size-md="6" v-for="(company, index) in [company1, company2]" :key="index" class="card-col">
                <div class="card-wrapper">
                  <ion-card class="animate-fade-in warrior-card">
                    <div class="warrior-image-container">
                      <div class="image-wrapper">
                        <img :src="companyImages[index]" :alt="`${company} warrior`" class="warrior-image"/>
                      </div>
                    </div>
                    <ion-card-header>
                      <ion-card-title>{{ company }}</ion-card-title>
                    </ion-card-header>
                    <ion-card-content>
                      <ion-list>
                        <ion-item v-for="(stat, statIndex) in stats[index]" :key="statIndex" class="animate-slide-in">
                          <ion-label>{{ getStatLabel(statIndex) }}</ion-label>
                          <ion-badge slot="end" :color="getStatColor(statIndex)">{{ stat }}</ion-badge>
                        </ion-item>
                      </ion-list>
                      <div class="animate-fade-in markdown-content" v-html="renderMarkdown(statsReasoning[index])"></div>
                      <ion-button 
                        expand="block" 
                        @click="downloadPDF(companyInfo[index].base64PDF, company)" 
                        class="download-button"
                        :disabled="!companyInfo[index] || !companyInfo[index].base64PDF"
                      >
                        有価証券報告書をダウンロード
                        (EDINET APIから提供)
                      </ion-button>
                    </ion-card-content>
                  </ion-card>
                </div>
              </ion-col>
            </ion-row>
          </ion-grid>

          <h2>バトル結果</h2>
          <ion-card>
            <ion-card-header>
              <ion-card-title>バトルログ</ion-card-title>
            </ion-card-header>
            <ion-card-content>
              <div class="battle-log animate-fade-in markdown-content" v-html="renderMarkdown(battleLog)"></div>
            </ion-card-content>
          </ion-card>

          <ion-card>
            <ion-card-header>
              <ion-card-title>負けた戦士へのアドバイス</ion-card-title>
            </ion-card-header>
            <ion-card-content>
              <div class="animate-fade-in markdown-content" v-html="renderMarkdown(advice)"></div>
            </ion-card-content>
          </ion-card>

          <ion-button expand="block" @click="resetBattle">
            リセット
          </ion-button>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script>
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonItem, IonLabel, IonInput, IonButton, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonList, IonBadge, IonGrid, IonRow, IonCol, IonSelect, IonSelectOption, IonSpinner, IonChip, IonIcon, alertController, IonPopover } from '@ionic/vue';
import { ref, reactive } from 'vue';
import axios from 'axios';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { closeCircle } from 'ionicons/icons';

export default {
  components: { 
    IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonItem, IonLabel, 
    IonInput, IonButton, IonCard, IonCardHeader, IonCardTitle, IonCardContent, 
    IonList, IonBadge, IonGrid, IonRow, IonCol, IonSelect, IonSelectOption, IonSpinner,
    IonChip, IonIcon, closeCircle, IonPopover
  },
  //初期化
  setup() {
    //関数の初期化
    const company1 = ref('');
    const company2 = ref('');
    const company1Input = ref('');
    const company2Input = ref('');
    const companyList1 = ref([]);
    const companyList2 = ref([]);
    const isLoading1 = ref(false);
    const isLoading2 = ref(false);
    const companyImages = ref(['', '']);
    const selectedBattlefield = ref('');
    const battlefields = [
      '湖底', '海底', '橋の上', '日本の古戦場', '廃墟の都市', 'ジャングル', 
      '砂漠', '雪山', '宇宙ステーション', '地下洞窟', '工場跡地', 
      '飛行船', '火山地帯', '地下鉄の駅'
    ];
    const battleStarted = ref(false);
    const stats = reactive([[], []]);
    const battleLog = ref('');
    const statsReasoning = reactive(['', '']);
    const advice = ref('');
    const isLoading = ref(false);
    const companyInfo = ref([]);

    //企業名をlist-companies APIから取得し、画面上に表示
    const searchCompanies = async (companyNumber) => {
      const companyInput = companyNumber === 1 ? company1Input.value : company2Input.value;
      if (companyInput.length < 1) {
        if (companyNumber === 1) {
          companyList1.value = [];
        } else {
          companyList2.value = [];
        }
        return;
      }

      if (companyNumber === 1) {
        isLoading1.value = true;
      } else {
        isLoading2.value = true;
      }

      try {
        const response = await axios.post('https://us-central1-brand-battler-427806.cloudfunctions.net/list-companies', {
          companyName: companyInput
        });

        if (companyNumber === 1) {
          companyList1.value = response.data;
        } else {
          companyList2.value = response.data;
        }
      } catch (error) {
        console.error('Error fetching company list:', error);
        await showErrorAlert('会社リストの取得中にエラーが発生しました。');
      } finally {
        if (companyNumber === 1) {
          isLoading1.value = false;
        } else {
          isLoading2.value = false;
        }
      }
    };

    //会社が選ばれた際の処理。会社名を決定し、企業候補一覧を消す。
    const selectCompany = (companyNumber, selectedCompany) => {
      if (companyNumber === 1) {
        company1.value = selectedCompany;
        companyList1.value = [];
      } else {
        company2.value = selectedCompany;
        companyList2.value = [];
      }
    };

    //選択済企業を空にする
    const clearSelectedCompany = (companyNumber) => {
      if (companyNumber === 1) {
        company1.value = '';
        company1Input.value = '';
      } else {
        company2.value = '';
        company2Input.value = '';
      }
    };

    //入力に反応する間隔の設定。毎入力事に処理をしているとAPIリクエストが増えすぎるため。
    let debounceTimer = null;
    //反応間隔の処理
    const debounce = (func, delay) => {
      return (...args) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => func(...args), delay);
      };
    };

    //頻繁な更新を防ぎながら企業を検索
    const debouncedSearchCompanies = debounce(searchCompanies, 300);

    //企業名入力がされた際に、企業一覧の取得を行う
    const onInputChange = (companyNumber, event) => {
      const value = event.target.value;
      if (companyNumber === 1) {
        company1Input.value = value;
      } else {
        company2Input.value = value;
      }
      debouncedSearchCompanies(companyNumber);
    };

    //日本語入力の場合、文字変換をした際企業一覧取得
    const onCompositionEnd = (companyNumber, event) => {
      const value = event.target.value;
      if (companyNumber === 1) {
        company1Input.value = value;
      } else {
        company2Input.value = value;
      }
      searchCompanies(companyNumber);
    };

    //バトルAPIコール
    const callBattleAPI = async () => {
      isLoading.value = true;
      try {
        //選択した企業名、戦場でbattle APIコール
        const response = await axios.post('https://asia-northeast1-brand-battler-427806.cloudfunctions.net/battle', {
          company1: company1.value,
          company2: company2.value,
          battlefield: selectedBattlefield.value
        });

        console.log(response);
        const { companyInfo: apiCompanyInfo, battleResult, advice: adviceText } = response.data;

        //返答を変数に格納
        companyInfo.value = apiCompanyInfo;
        
        apiCompanyInfo.forEach((company, index) => {
          stats[index] = JSON.parse(company.statNum);
          statsReasoning[index] = company.statReason;
          try {
            companyImages.value[index] = company.imageUrl;
          } catch (error) {
            companyImages.value[index] = '';
            console.error('Error setting company image URL:', error);
          }
        });

        battleLog.value = battleResult;
        advice.value = adviceText;
        //バトル開始設定
        battleStarted.value = true;
      } catch (error) {
        console.error('Error calling battle API:', error);
        await showErrorAlert('APIエラーが発生しました。もう一度お試しください。');
      } finally {
        isLoading.value = false;
      }
    };

    //バトル開始ボタン用関数
    const startBattle = async () => {
      if (company1.value && company2.value && selectedBattlefield.value) {
        //必要な情報が入力されていれば、バトルAPIコール
        await callBattleAPI();
      }
    };

    //バトルリセットボタン用関数
    const resetBattle = () => {
      //数値の初期化
      battleStarted.value = false;
      company1.value = '';
      company2.value = '';
      company1Input.value = '';
      company2Input.value = '';
      companyList1.value = [];
      companyList2.value = [];
      selectedBattlefield.value = '';
      battleLog.value = '';
      companyImages.value = ['', ''];
      stats.forEach(stat => stat.splice(0, stat.length));
      statsReasoning.forEach((_, index) => statsReasoning[index] = '');
      advice.value = '';
      companyInfo.value = [];
    };

    //有価証券報告書ダウンロードボタン用関数
    const downloadPDF = (base64PDF, companyName) => {
      //バトルAPIの結果にPDFのbase64データが含まれていれば、ファイル化してダウンロード
      if (!base64PDF) {
        console.error('No PDF data available');
        return;
      }
      const byteCharacters = atob(base64PDF);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], {type: 'application/pdf'});
      
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = `${companyName}_有価証券報告書.pdf`;
      link.click();
    };

    //ファイターのステータスの名前の取得
    const getStatLabel = (statIndex) => {
      const labels = [
        'HP (財務指標 BS)',
        'ちから (財務指標 PL)',
        'かしこさ (知的資本)',
        '回避 (ガバナンス)',
        '丈夫さ (エンゲージメント)'
      ];
      return labels[statIndex];
    };

    //インデックスから色の取得
    const getStatColor = (statIndex) => {
      const colors = ['danger', 'primary', 'secondary', 'tertiary', 'success'];
      return colors[statIndex];
    };

    //llm出力結果のマークダウンのレンダリング
    const renderMarkdown = (text) => {
      marked.setOptions({
        breaks: false, // Change this to false
        gfm: true,
        headerIds: false,
        headerPrefix: '',
        mangle: false,
        sanitize: false,
        smartLists: true,
        smartypants: false,
        xhtml: false
      });

      const rawMarkup = marked.parse(text);
      
      const cleanedMarkup = rawMarkup.replace(/>\s+</g, '><');
      
      return DOMPurify.sanitize(cleanedMarkup);
    };

    //アラート表示
    const showErrorAlert = async (message) => {
      const alert = await alertController.create({
        header: 'エラー',
        message: message,
        buttons: ['OK']
      });
      await alert.present();
    };

    //Ionic要素上でアクセスできるようにエクスポート
    return {
      company1,
      company2,
      company1Input,
      company2Input,
      companyList1,
      companyList2,
      isLoading1,
      isLoading2,
      selectedBattlefield,
      battlefields,
      battleStarted,
      stats,
      statsReasoning,
      companyImages,
      battleLog,
      advice,
      isLoading,
      startBattle,
      resetBattle,
      searchCompanies,
      selectCompany,
      clearSelectedCompany,
      getStatLabel,
      getStatColor,
      renderMarkdown,
      companyInfo,
      downloadPDF,
      closeCircle,
      onInputChange,
      onCompositionEnd,
      closeCircle
    };
  }
};
</script>

<style scoped>
.battle-log {
  white-space: pre-wrap;
  margin-bottom: 10px;
}

.warrior-image-container {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  padding-top: 100%; /* This creates a 1:1 aspect ratio */
  position: relative;
  overflow: hidden;
}

.image-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  justify-content: center;
  align-items: center;
}

.warrior-image {
  width: 100%;
  height: 100%;
  object-fit: cover; /* This will crop the image to fill the square */
}

@media (min-width: 768px) {
  ion-col {
    max-width: 50%;
  }
}

.animate-fade-in {
  animation: fadeIn 0.5s ease-out;
}

.animate-slide-in {
  animation: slideIn 0.5s ease-out;
}

.animate-letter {
  display: inline-block;
  opacity: 0;
  animation: fadeInLetter 0.5s forwards;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideIn {
  from { transform: translateX(-20px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

@keyframes fadeInLetter {
  to { opacity: 1; }
}

.battle-round {
  margin-bottom: 20px;
}

.battlefield-label {
  flex: 0 0 auto;
  width: 60px;
}

.battlefield-select {
  flex: 1 1 auto;
}

.company-input {
  --padding-top: 8px;
  --padding-bottom: 8px;
}

ion-item {
  --min-height: 60px;
}

.main-container {
  max-width: 80%;
  margin: 0 auto;
}

@media (max-width: 768px) {
  .main-container {
    max-width: 100%;
  }
}

.markdown-content {
  font-size: 1rem;
  line-height: 1.6;
}

.markdown-content p {
  margin-bottom: 1em;
}

.markdown-content ul,
.markdown-content ol {
  margin-bottom: 1em;
  padding-left: 2em;
}

.markdown-content li {
  margin-bottom: 0.5em;
}

.markdown-content h1,
.markdown-content h2,
.markdown-content h3,
.markdown-content h4,
.markdown-content h5,
.markdown-content h6 {
  margin-top: 1em;
  margin-bottom: 0.5em;
}

.markdown-content code {
  background-color: #f4f4f4;
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-family: monospace;
}

.markdown-content pre {
  background-color: #f4f4f4;
  padding: 1em;
  border-radius: 5px;
  overflow-x: auto;
}

.markdown-content blockquote {
  border-left: 4px solid #ccc;
  margin-left: 0;
  padding-left: 1em;
  color: #666;
}

.markdown-content img {
  max-width: 100%;
  height: auto;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
}

.loading-container p {
  margin-top: 20px;
  font-size: 1.2em;
  color: var(--ion-color-medium);
}

.download-button {
  margin-top: 15px;
}

.card-row {
  display: flex;
  align-items: stretch;
}

.card-col {
  display: flex;
}

.card-wrapper {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.warrior-card {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.warrior-card ion-card-content {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
}

.warrior-card .download-button {
  margin-top: auto;
}

@media (max-width: 767px) {
  .card-row {
    flex-direction: column;
  }
}

.company-list-container {
  position: relative;
  max-height: 200px;
  overflow-y: auto;
}

.company-list {
  background-color: var(--ion-background-color);
  border: 1px solid var(--ion-color-medium);
  border-radius: 4px;
  margin-top: 4px;
}

.company-list ion-item {
  --padding-start: 8px;
  --padding-end: 8px;
  --min-height: 36px;
}

.loading-indicator {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1000;
}
</style>