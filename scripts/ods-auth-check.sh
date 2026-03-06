#!/bin/bash
# ODS Admin Auth — validates credentials via su (PAM-native, yescrypt-safe)
USER="$1"; PASS="$2"
[ -z "$USER" ] || [ -z "$PASS" ] && { echo "FAIL"; exit 1; }
# su invokes PAM which handles any hash algorithm including yescrypt ($y$)
if echo "$PASS" | su -c "echo OK" "$USER" 2>/dev/null | grep -q "^OK$"; then
    echo "OK"
else
    echo "FAIL"
fi
