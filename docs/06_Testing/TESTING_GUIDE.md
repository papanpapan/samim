# Testing documents — SN-ERMS

## Integration journey (manual / future automated)

1. Platform onboard nursery  
2. Mother entry with photo  
3. Propagation batch → mist → hardening → ready  
4. Inventory sellable SKU  
5. POS sale  
6. Field Hub care + scion  
7. Voice agent query_stock  

## API smoke

```http
POST /api/v1/voice-agent/parse
Authorization: Bearer <jwt>
X-Nursery-Id: <uuid>
{ "text": "today sales" }
```

## Regression focus

Login, tenant header, stock ledger, POS GST for INR, live camera alarm path.
