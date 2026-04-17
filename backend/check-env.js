#!/usr/bin/env node
"use strict";
require("dotenv").config();
const { spawn } = require("child_process");
const https = require("https");

const OK   = "  ✅";
const WARN = "  ⚠️ ";
const FAIL = "  ❌";

async function main() {
  console.log("\n🔍 VeriSol AI — Environment Check\n");
  let hasErrors = false;

  const nodeVersion = parseInt(process.version.slice(1));
  if (nodeVersion >= 18) { console.log(`${OK} Node.js ${process.version}`); }
  else { console.log(`${FAIL} Node.js ${process.version} needs >=18`); hasErrors = true; }

  if (process.env.OPENAI_API_KEY) {
    const masked = process.env.OPENAI_API_KEY.slice(0,8)+"...";
    console.log(`${OK} OPENAI_API_KEY set (${masked})`);
    const valid = await pingOpenAI(process.env.OPENAI_API_KEY);
    if (valid) console.log(`${OK} OpenAI API key is valid`);
    else { console.log(`${FAIL} OpenAI API key is invalid, out of quota, or model unavailable`); hasErrors = true; }
  } else { console.log(`${FAIL} OPENAI_API_KEY not set`); hasErrors = true; }

  if (process.env.ETHERSCAN_API_KEY) { console.log(`${OK} ETHERSCAN_API_KEY set`); }
  else { console.log(`${WARN} ETHERSCAN_API_KEY not set — address scanning disabled`); }

  const forge = process.env.FOUNDRY_PATH || "forge";
  const forgeV = await getBinVersion(forge, "--version");
  console.log(forgeV ? `${OK} forge: ${forgeV}` : `${WARN} forge not found — install: curl -L https://foundry.paradigm.xyz | bash && foundryup`);

  const castOk = await checkBin(forge.replace("forge","cast"), "--version");
  console.log(castOk ? `${OK} cast found` : `${WARN} cast not found`);

  const gitOk = await checkBin("git","--version");
  console.log(gitOk ? `${OK} git found` : `${WARN} git not found`);

  const fs = require("fs-extra");
  const tmp = process.env.TEMP_DIR || "/tmp/verisol";
  try { await fs.ensureDir(tmp); console.log(`${OK} TEMP_DIR: ${tmp}`); }
  catch { console.log(`${FAIL} Cannot create TEMP_DIR: ${tmp}`); hasErrors = true; }

  console.log(`${OK} PORT: ${process.env.PORT||3001}`);

  console.log(hasErrors
    ? "\n❌ Fix errors above before starting.\n"
    : "\n✅ All checks passed — run `npm run dev`\n");
  process.exit(hasErrors ? 1 : 0);
}

function getBinVersion(bin, arg) {
  return new Promise(resolve => {
    let out = "";
    const p = spawn(bin,[arg],{stdio:"pipe"});
    p.stdout.on("data",d=>(out+=d));
    p.on("close",c=>resolve(c===0?out.trim():null));
    p.on("error",()=>resolve(null));
  });
}
function checkBin(bin,arg) {
  return new Promise(resolve=>{
    const p=spawn(bin,[arg],{stdio:"pipe"});
    p.on("close",c=>resolve(c===0));
    p.on("error",()=>resolve(false));
  });
}
function pingOpenAI(key) {
  return new Promise(resolve=>{
    const model = process.env.OPENAI_MODEL_FAST || process.env.OPENAI_MODEL || "gpt-4.1-mini";
    const body=JSON.stringify({model,input:"hi",max_output_tokens:16});
    const req=https.request({
      hostname:"api.openai.com",
      path:"/v1/responses",
      method:"POST",
      headers:{
        "Authorization":`Bearer ${key}`,
        "Content-Type":"application/json",
        "Content-Length":Buffer.byteLength(body)
      }
    },res=>{
      let d=""; res.on("data",x=>(d+=x)); res.on("end",()=>resolve(res.statusCode===200));
    });
    req.on("error",()=>resolve(false));
    req.setTimeout(8000,()=>{req.destroy();resolve(false);});
    req.write(body); req.end();
  });
}
main();
