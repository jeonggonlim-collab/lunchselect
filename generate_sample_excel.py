import openpyxl

wb = openpyxl.Workbook()
ws = wb.active
ws.title = "restaurants"

headers = ["식당명", "종류", "음식종류", "거리"]
ws.append(headers)

rows = [
    ("명동교자", "한식", "면류", 150),
    ("국밥집",   "한식", "밥류", 220),
    ("신전떡볶이", "한식", "분식", 180),
    ("목구멍",   "한식", "고기", 400),
    ("VIPS",     "양식", "고기", 700),
    ("이탈리안키친", "양식", "면류", 500),
    ("피자헛",   "양식", "피자", 450),
    ("홍콩반점", "중식", "면류", 200),
    ("딘타이펑", "중식", "면류", 600),
    ("마라향",   "중식", "그외", 350),
    ("스시야",   "일식", "밥류", 300),
    ("라멘타로", "일식", "면류", 280),
]

for row in rows:
    ws.append(row)

for col, width in zip("ABCD", (16, 10, 12, 10)):
    ws.column_dimensions[col].width = width

wb.save("restaurants.xlsx")
print("saved")
