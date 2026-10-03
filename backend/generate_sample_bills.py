import os
from PIL import Image, ImageDraw, ImageFont

def create_sample_bill(output_path, invoice_no="INV-2024-8841", date_str="14/03/2024", amount_str="48,250.00"):
    # Create white canvas
    width, height = 800, 1050
    img = Image.new("RGB", (width, height), color=(250, 250, 252))
    draw = ImageDraw.Draw(img)

    # Header border & brand
    draw.rectangle([(30, 30), (770, 1020)], outline=(180, 190, 205), width=2)
    draw.rectangle([(30, 30), (770, 110)], fill=(30, 41, 59))
    
    # Title
    draw.text((50, 48), "APEX INDUSTRIAL SUPPLIES PVT LTD", fill=(255, 255, 255))
    draw.text((50, 75), "TAX INVOICE / BILL OF SUPPLY", fill=(200, 220, 255))

    # Meta Section Box
    draw.rectangle([(50, 130), (750, 230)], outline=(220, 225, 235), fill=(245, 247, 250))
    draw.text((65, 145), f"Invoice No: {invoice_no}", fill=(20, 20, 20))
    draw.text((65, 175), f"Invoice Date: {date_str}", fill=(20, 20, 20))
    draw.text((65, 200), "Payment Terms: 30 Days Net", fill=(80, 80, 80))

    draw.text((450, 145), "Billed To:", fill=(20, 20, 20))
    draw.text((450, 170), "Site Office - Mumbai North", fill=(50, 50, 50))
    draw.text((450, 195), "Plot 12, MIDC Industrial Area", fill=(80, 80, 80))

    # Line Items Table Header
    draw.rectangle([(50, 260), (750, 295)], fill=(226, 232, 240))
    draw.text((65, 272), "Item Description", fill=(30, 41, 59))
    draw.text((400, 272), "Qty", fill=(30, 41, 59))
    draw.text((500, 272), "Unit Price", fill=(30, 41, 59))
    draw.text((640, 272), "Total Amount", fill=(30, 41, 59))

    # Table rows
    rows = [
        ("High-Tensile Steel Bolts M16", "250 pcs", "75.00", "18,750.00"),
        ("Reinforced Concrete Sealant (20L)", "10 cans", "1,850.00", "18,500.00"),
        ("Heavy Duty Cable Trays 3M", "15 units", "733.33", "11,000.00"),
    ]

    y = 315
    for desc, qty, rate, tot in rows:
        draw.text((65, y), desc, fill=(40, 40, 40))
        draw.text((400, y), qty, fill=(40, 40, 40))
        draw.text((500, y), rate, fill=(40, 40, 40))
        draw.text((640, y), tot, fill=(40, 40, 40))
        y += 40
        draw.line([(50, y - 10), (750, y - 10)], fill=(235, 238, 245), width=1)

    # Grand Total Banner
    draw.rectangle([(420, 500), (750, 560)], fill=(241, 245, 249), outline=(203, 213, 225))
    draw.text((440, 520), f"Grand Total: Rs. {amount_str}", fill=(15, 23, 42))

    # Footer Notes
    draw.text((50, 850), "Authorized Signatory:", fill=(80, 80, 80))
    draw.text((50, 920), "For Apex Industrial Supplies Pvt Ltd", fill=(40, 40, 40))
    draw.text((50, 950), "(Physical Bill Scan Copy)", fill=(120, 120, 120))

    # Save
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    img.save(output_path, "JPEG", quality=92)
    print(f"Sample bill created at: {output_path}")

if __name__ == "__main__":
    out = os.path.join(os.path.dirname(__file__), "uploads", "sample_bill_1.jpg")
    create_sample_bill(out)
