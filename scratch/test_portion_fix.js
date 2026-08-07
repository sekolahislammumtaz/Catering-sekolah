const { calculateCateringDates } = require('../db');

function simulateUserScenario() {
  console.log('--- Testing Catering Portion Preservation Fix ---\n');

  const holidays = [];
  const sickDates = [];

  // 1. Initial state on Monday (2026-08-03):
  // 10 students with 10 days quota starting 2026-08-03
  const students = [];
  for (let i = 1; i <= 10; i++) {
    students.push({
      id: `std-${i}`,
      name: `Siswa ${i}`,
      start_date: '2026-08-03',
      initial_quota: 10,
      catering_dates: calculateCateringDates('2026-08-03', 10, holidays, sickDates)
    });
  }

  // 11th student (Student X) with 4 days quota (Mon 08-03, Tue 08-04, Wed 08-05, Thu 08-06)
  const studentX = {
    id: 'std-11',
    name: 'Siswa 11 (Habis Kamis)',
    start_date: '2026-08-03',
    initial_quota: 4,
    catering_dates: calculateCateringDates('2026-08-03', 4, holidays, sickDates)
  };
  students.push(studentX);

  const weekDays = ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07'];

  function getDailyPortions(currentStudents) {
    return weekDays.map(dateStr => {
      const count = currentStudents.filter(s => (s.catering_dates || []).includes(dateStr)).length;
      return { date: dateStr, count };
    });
  }

  console.log('1. Keadaan saat dibuka di Hari Senin/Selasa:');
  console.log(getDailyPortions(students));

  console.log('\n2. Keadaan saat dibuka di Hari Kamis (Sebelum perpanjangan Student 11):');
  console.log(getDailyPortions(students));

  // 3. On Friday (2026-08-07), admin extends Student 11 starting 2026-08-07 for 5 new days:
  const newStartDate = '2026-08-07';
  const newQuota = 5;

  // Preserve past dates < 2026-08-07
  const pastDates = studentX.catering_dates.filter(d => d < newStartDate);
  const newActiveDates = calculateCateringDates(newStartDate, newQuota, holidays, sickDates);
  const combinedDates = Array.from(new Set([...pastDates, ...newActiveDates])).sort();

  studentX.catering_dates = combinedDates;
  studentX.initial_quota = combinedDates.length;
  studentX.start_date = combinedDates[0];

  console.log('\n3. Keadaan saat dibuka di Hari Jumat (SETELAH Student 11 diperpanjang pada 2026-08-07):');
  const resultOnFriday = getDailyPortions(students);
  console.log(resultOnFriday);

  // Assertions
  const monCount = resultOnFriday.find(r => r.date === '2026-08-03').count;
  const tueCount = resultOnFriday.find(r => r.date === '2026-08-04').count;
  const wedCount = resultOnFriday.find(r => r.date === '2026-08-05').count;
  const thuCount = resultOnFriday.find(r => r.date === '2026-08-06').count;
  const friCount = resultOnFriday.find(r => r.date === '2026-08-07').count;

  if (monCount === 11 && tueCount === 11 && wedCount === 11 && thuCount === 11 && friCount === 11) {
    console.log('\n✅ VERIFIKASI SUKSES: Jumlah porsi historis Senin-Kamis TETAP UTUH (11) dan porsi Jumat menjadi 11!');
  } else {
    console.error('\n❌ VERIFIKASI GAGAL: Jumlah porsi berubah tidak sesuai ekspektasi!');
  }
}

simulateUserScenario();
