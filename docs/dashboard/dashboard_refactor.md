You are a frontend engineer with 10 years of experience. You prioritize user experience and responsive design.
Your goal is to refactor the '/dashboard' page on my webapp.

Right now, the state of the UIUX is a mockup based on my current dashboard layout on my Google Sheet.
Using appropriate skills and tools, you can make any changes you think are necessary to improve the UIUX.
The only constraint is that the colors and design system must adhere to the existing CSS files in the 'public' folder. Make it production grade, commercially viable, and highly optimized.
The main thing is that the dashboard must not be too big or too small to view on a regular laptop screen, no unnecessary page scroll should exist. All rows should be scrollable inside its container

There are must needed items present on the dashboard:

Identity Section

1. Cohort name
2. Intake year - baptism year
3. Priest in charge

Class Demographics

1. Total students
2. Gender split
3. Religion split + chart
4. Marital status + chart

Key Attendance Metrics -> an example chart will be stored in the /screenshot folder

1. Student's attendance status + chart (based on the latest class attendance column entry), separated into 4 categories:
   a. Zona Hijau - Kehadiran >85%
   b. Zona Kuning - Kehadiran 65-85%
   c. Zona Merah - Kehadiran 50-65%
   d. Zona Hitam - Kehadiran <50%
2. Latest Topic covered (based on the latest class attendance column entry)
3. The last 4 topics covered (based on the last 4 class attendance columns), scrollable to the first topic, show percentage
4. Class attendance trend (sorted by lowest to highest, based on the 4 lowest class attendance columns), show percentage

Students Warning List

1. List of students in the Zona Merah + Zona Hitam excluding those with the 'Inactive' status with the following information:
   a. Name + Picture
   b. Total attendance percentage
   c. Attendance status (Zona Hijau, Kuning, Merah, Hitam)
   d. Contact number (clickable to open whatsapp on mobile)
   e. Their Katekis KK (Kelompok Kecil)
2. Search bar to search for a student by name
