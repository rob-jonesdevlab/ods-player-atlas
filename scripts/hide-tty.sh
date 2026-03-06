#!/bin/bash
# Completely suppress tty1 output to prevent ANSI escape leaks
exec > /dev/tty1 2>&1
stty -echo -F /dev/tty1 2>/dev/null || true
setterm --foreground black --background black --cursor off > /dev/tty1 2>/dev/null || true
printf "\033[2J\033[H" > /dev/tty1 2>/dev/null || true
printf "\033[?25l" > /dev/tty1 2>/dev/null || true
