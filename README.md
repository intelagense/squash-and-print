# squash-and-print
It squashes an image in the browser and prints it on a thermal printer. 🤷

## structure overview

```
.
├── data/
│   └── jobs.jsonl // jsonl db for print queue
├── helper/
│   └── print.js // custom print driver for ESC/POS commands
├── public
├── env.example // copy into a new .env locally
└── server.js // express server
```

## running for testing

`npm install` to set up server deps.
`npm run dev` to start the test server on port 58008.