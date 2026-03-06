#!/bin/bash
# ODS Three-Word Hostname — deterministic MAC-to-words encoding
# 256 words × 3 positions = 16,777,216 unique devices
# Usage: ods-hostname.sh [generate|decode <name>]
WORDS=(
  # 0-63: Adjectives
  brave bold calm cool dart dawn deep dusk echo fair fast firm fond free
  glad gold good glow halt haze high huge idle iron jade jolly keen kind
  last lean live long loud lush mint mild moon near neat next nice nova
  open orca pace palm peak pine play plum pure quad rain rare real rich
  # 64-127: Colors & Nature
  ruby safe sage sand silk slim snow soft solo star stem sure tame teal
  tide tiny trek true tune vale vast vine warm wave west wild wind wise
  zero aqua ashe bark beam blue bone clay coal cyan dune fawn fern flax
  foam grey husk iced iris jade kelp lake lava leaf lime lynx malt marl
  # 128-191: Animals & Objects
  mesa mint moss navy neon oaks opal palm pear pine pink plum pond reed
  reef rose rust sage sand silk snow teak twig vine wren yarn zinc acorn
  amber azure bloom brass cedar cherry cloud coral crane crest crown dart
  delta drift ember flame frost gleam grain grove haven helix ivory jewel
  # 192-255: More Nature & Friendly
  knoll lapis lilac lunar maple marsh meadow mirth north ocean olive pearl
  petal prism quail ridge river robin shell shore spark steam stone storm
  swift thorn torch trail tulip vapor vivid waltz wheat whirl aspen birch
  bliss cedar charm clover crystal dahlia forest garden gentle harbor haven
)

get_mac_bytes() {
    # ALWAYS use ethernet MAC for consistent hostname (not wlan0 which differs in AP mode)
    local mac=$(cat /sys/class/net/end0/address 2>/dev/null || cat /sys/class/net/eth0/address 2>/dev/null || echo "00:00:00:00:00:00")
    # Take last 3 bytes
    local b1=$(echo "$mac" | cut -d: -f4)
    local b2=$(echo "$mac" | cut -d: -f5)
    local b3=$(echo "$mac" | cut -d: -f6)
    echo "$((16#$b1)) $((16#$b2)) $((16#$b3))"
}

case "${1:-generate}" in
    generate)
        read -r b1 b2 b3 <<< "$(get_mac_bytes)"
        echo "${WORDS[$b1]}-${WORDS[$b2]}-${WORDS[$b3]}"
        ;;
    decode)
        # Reverse: name → MAC bytes
        IFS='-' read -r w1 w2 w3 <<< "$2"
        for i in "${!WORDS[@]}"; do
            [ "${WORDS[$i]}" = "$w1" ] && b1=$i
            [ "${WORDS[$i]}" = "$w2" ] && b2=$i
            [ "${WORDS[$i]}" = "$w3" ] && b3=$i
        done
        printf "xx:xx:xx:%02x:%02x:%02x\n" "$b1" "$b2" "$b3"
        ;;
    mac)
        get_mac_bytes
        ;;
esac
