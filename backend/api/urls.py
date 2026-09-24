from django.urls import path
from . import views

urlpatterns = [
    path('analyze/', views.analyze, name='analyze'),
    path('runs/', views.prepare, name='prepare'),
    path('runs/<uuid:run_id>/topics/', views.topics, name='topics'),
    path('runs/<uuid:run_id>/opinions/', views.opinions, name='opinions'),
]