const url = "https://script.google.com/macros/s/AKfycbyZiuCTXjyRWBqaqmTHENzJHhtCMoCcNKVqkzrv2YmCWL7jMLRvcA9n39PHljJtZX5b/exec";
const payload = { type: 'PULL_ALL' };

fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'text/plain;charset=utf-8',
  },
  body: JSON.stringify(payload)
})
.then(res => {
  console.log('Status:', res.status);
  return res.text();
})
.then(text => console.log('Response:', text))
.catch(err => console.error('Error:', err));
