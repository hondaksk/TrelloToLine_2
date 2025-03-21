const express = require('express');
const axios = require('axios');
const Queue = require('async/queue');

const app = express();
app.use(express.json({ limit: '2mb' }));

const USERS = {
  A: { LINE_TOKEN: process.env.LINE_TOKEN_A, USER_ID: process.env.USER_ID_A },
  B: { LINE_TOKEN: process.env.LINE_TOKEN_B, USER_ID: process.env.USER_ID_B }
};

const LINE_URL = 'https://api.line.me/v2/bot/message/push';

// LINE送信キュー
const sendQueue = Queue((task, callback) => {
  const { userKey, message } = task;
  const { LINE_TOKEN, USER_ID } = USERS[userKey];
  axios.post(LINE_URL, { to: USER_ID, messages: [{ type: 'text', text: message }] }, {
    headers: { 'Authorization': `Bearer ${LINE_TOKEN}`, 'Content-Type': 'application/json' }
  })
    .then(() => {
      console.log(`アカウント_${userKey}にメッセージを送信しました`);
      callback();
    })
    .catch(error => {
      console.error(`アカウント_${userKey}への送信失敗: ${error.message}`);
      callback(error);
    });
}, 1);

// Webhook受信
app.post('/', (req, res) => {
  const action = req.body.action;
  console.log('Webhook受信:', { type: action?.type, boardId: req.body.model?.id });
  if (!action) return res.sendStatus(200);

  const boardId = req.body.model?.id;
  const boardName = req.body.model?.name;
  let message = '';

  if (action.type === 'createCard') {
    message = `#${boardName}\n"${action.data.list.name}"に「${action.data.card.name}」が追加されました`;
  } else if (action.type === 'updateCard' && action.data.listAfter?.name === 'Done' && action.data.listBefore?.name !== 'Done') {
    message = `#${boardName}\n「${action.data.card.name}」が完了しました`;
  } else if (action.type === 'updateCard' && action.data.listAfter?.name === 'Routine' && action.data.listBefore?.name === 'Done') {
    message = `#${boardName}\n「${action.data.card.name}」がリセットされました`;
  } else {
    return res.sendStatus(200);
  }

  if (boardId === '67d16cc34fd76a26335e19c9') {
    sendQueue.push({ userKey: 'A', message });
    sendQueue.push({ userKey: 'B', message });
  } else if (boardId === '65098af9702e06a1a73e67f9') {
    sendQueue.push({ userKey: 'A', message });
  } else if (boardId === '67d92ab8970951ecc1374b1b') {
    sendQueue.push({ userKey: 'B', message });
  }

  res.sendStatus(200);
});

// ヘルスチェック
app.get('/', (req, res) => res.send('Server is alive!'));

// 稼働確認用エンドポイント
app.get('/check', (req, res) => {
  const status = {
    server: 'running',
    queueLength: sendQueue.length(),
    timestamp: new Date().toISOString()
  };
  res.json(status);
});

app.listen(process.env.PORT || 3000, () => console.log('サーバーが起動しました'));
