from fitts_data import FittsDataClient
import matplotlib.pyplot as plt

name = "P01"
session = "S1"
fd = FittsDataClient()
fig, ax= fd.plot_fitts_regression(
                participant=name,
                session=session,
            )
plt.show()

print(f"A _effective = {fd.get_A(
    participant=name,
    session=session,
    effective=True
)}")

print(f"W_effective{fd.get_W(
    participant=name,
    session=session,
    effective=True
)}")
groups = fd.group_by_ID(
    participant=name,
    session="S1",
)

print(groups.keys())

fig, ax = fd.plot_boxplot_by_group(
    groups,
    value_column="mt_ms",
    title="MT pro ID",
    ylabel="MT [ms]",
)

plt.show()

print(fd.session_report(
    participant= name,
    session=session,
))

print(fd.get_interaction_counts_per_trial(
    participant=name,
    session=session,
))

print(fd.verify_interaction_count(
    participant=name,
    session=session,
))

print(fd.describe_interaction_MT(
    participant=name,
    session=session,
))