# Saba Voice Chatbot — Test Report

Date: 2026-09-26T18:34:30.475Z
API: http://localhost:4000/api/v1
Result: 9/9 passed, 0 failed

| Status | Query | Intent | Conf | Summary (trim) |
|--------|-------|--------|------|----------------|
| PASS | hey saba | greet | 0.99 | জি Samim, কীভাবে সাহায্য করব? আপনি জিজ্ঞাসা করতে পারেন: আমের স্টক কত · আজকের বিক্রি · মাদার কত · লো স্টক। |
| PASS | ajj adinium stok koro | query_ask | 0.94 | আজ Adenium স্টক আছে 11টি। বিস্তারিত: Adenium 11। আপনি আরও জিজ্ঞাসা করতে পারেন: আজকের বিক্রি · Adenium দাম · লো স্টক · মাদার কত। |
| PASS | আজ এডেনিয়াম স্টক কত | query_ask | 0.94 | আজ Adenium স্টক আছে 11টি। বিস্তারিত: Adenium 11। আপনি আরও জিজ্ঞাসা করতে পারেন: আজকের বিক্রি · Adenium দাম · লো স্টক · মাদার কত। |
| PASS | adenium stock today | query_ask | 0.94 | Today Adenium stock is 11. Details: Adenium 11. You can also ask: today sales · Adenium price · low stock · how many mothers. |
| PASS | today sales | query_ask | 0.95 | all plants: today 0 sold, ৳0 (0 bills). You can also ask: today stock · low stock · nursery summary. |
| PASS | low stock | query_ask | 0.94 | Low-stock SKUs: 1. Adenium 11/15 You can also ask: mango stock · today sales · price. |
| PASS | how many mothers | query_ask | 0.93 | Mothers: 50. Unhealthy: 40. MP-DEMO-50 Tulsi (কলম 10); MP-DEMO-49 Tulsi (কলম 273); MP-DEMO-48 Tulsi (কলম 256); MP-DEMO-47 Tulsi (কলম 239); MP-DEMO-46 Tulsi (কলম |
| PASS | সাহায্য | query_ask | 0.95 | Saba Nursery-এ: Today, Field Hub, Mother Plants, Propagation, Inventory, POS, Care, Alerts, Staff & Team। জিজ্ঞাসা: স্টক / বিক্রি / মাদার / ব্যাচ / কেয়ার / অ্য |
| PASS | xyz abc nonsense | query_ask | 0 | I am not sure yet. Try: stock, today sales, mothers, batches, care, alerts, low stock, or help. Example: "mango stock". You can also ask: mango stock · today sa |
