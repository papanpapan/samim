# SN-ERMS Flutter Mobile Client

Production-track Flutter app for field POS, mother tags, offline checklists, speech, and ESC/POS printers.

## Status

Scaffold for Clean Architecture + Riverpod. Wire against the same `/api/v1` backend as the PWA.

## Setup

```bash
cd flutter_mobile_app
flutter create . --project-name sn_erms_mobile
flutter pub add flutter_riverpod dio sqflite mobile_scanner speech_to_text esc_pos_utils esc_pos_bluetooth
flutter run
```

## Features (roadmap)

| Feature | Package / approach |
|---------|-------------------|
| QR / barcode POS | `mobile_scanner` |
| Offline checklist / stock cache | `sqflite` + background sync |
| Speech BN/HI/EN | `speech_to_text` |
| Thermal 2"/3" | ESC/POS Bluetooth |

## API

Set base URL to your LAN API, e.g. `https://192.168.x.x:4000/api/v1` with JWT + `X-Nursery-Id`.
