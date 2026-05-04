# Whitepoint Dental Studio — appointment slot grid (IST, 24-hour)
# Mon–Sat: 9:00 AM – 8:00 PM  |  Sun: 10:00 AM – 2:00 PM
# Each slot is 30 min; clinic closes at 8 PM so last slot starts at 19:30.
# Lunch break: 12:30–14:00 (no slots in that window).

AVAILABLE_SLOTS = [
    "09:00",
    "09:30",
    "10:00",
    "10:30",
    "11:00",
    "11:30",   # used in Maya's "11:30 AM or 5 PM" offer
    "12:00",
    "12:30",
    # --- lunch break 13:00–14:00 ---
    "14:00",
    "14:30",
    "15:00",
    "15:30",
    "16:00",
    "16:30",
    "17:00",   # 5 PM — Rohan Mehta's chosen slot
    "17:30",
    "18:00",
    "18:30",
    "19:00",
    "19:30",   # last slot — patient out by 8:00 PM
]

# Sunday slots (shorter window: 10:00 AM – 2:00 PM)
SUNDAY_SLOTS = [
    "10:00",
    "10:30",
    "11:00",
    "11:30",
    "12:00",
    "12:30",
    "13:00",
    "13:30",
]